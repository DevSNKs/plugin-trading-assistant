import os
import subprocess
import json
import shutil
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def run_command(command, cwd=None):
    """Execute a shell command and handle errors"""
    try:
        subprocess.run(command, check=True, shell=True, cwd=cwd)
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e}")
        return False

def get_postgres_url():
    """Prompt user for PostgreSQL connection details"""
    logger.info("Please enter PostgreSQL connection details (press Enter to skip):")
    db_name = input("Database name: ").strip()
    if not db_name:
        return ""

    host = input("Host (default: localhost): ").strip() or "localhost"
    port = input("Port (default: 5432): ").strip() or "5432"
    username = input("Username: ").strip()
    password = input("Password: ").strip()

    return f"postgresql://{username}:{password}@{host}:{port}/{db_name}"

def get_user_input(prompt):
    """Get user input with option to skip"""
    return input(f"{prompt} (press Enter to skip): ").strip()

def modify_package_json(eliza_path):
    """Add trading assistant plugin to agent's package.json"""
    package_json_path = os.path.join(eliza_path, "agent", "package.json")

    try:
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)

        package_data['dependencies']["@ai16z/plugin-trading-assistant"] = "workspace:*"

        with open(package_json_path, 'w') as f:
            json.dump(package_data, f, indent=4)

        logger.info("Successfully modified package.json")
        return True
    except Exception as e:
        logger.error(f"Failed to modify package.json: {e}")
        return False

def create_character_file(plugin_path):
    """Create and populate the character file"""
    character_data = {
        "name": "QuantAI",
        "username": "QuantAI",
        "description": "A trading assistant AI",
        "modelProvider": "openai",
        "clients": ["telegram", "twitter"],
        "settings": {
            "secrets": {
                "TRADING_DB_URL": get_postgres_url(),
                "OPENAI_API_KEY": get_user_input("OpenAI API Key"),
                "TELEGRAM_BOT_TOKEN": get_user_input("Telegram Bot Token"),
                "TWITTER_USERNAME": get_user_input("Twitter Username"),
                "TWITTER_PASSWORD": get_user_input("Twitter Password"),
                "TWITTER_EMAIL": get_user_input("Twitter Email"),
                "TWITTER_COOKIES": get_user_input("Twitter Cookies")
            }
        }
    }

    characters_dir = os.path.join(plugin_path, "characters")
    os.makedirs(characters_dir, exist_ok=True)

    with open(os.path.join(characters_dir, "quantai.character.json"), 'w') as f:
        json.dump(character_data, f, indent=4)

def main():
    try:
        # Clone Eliza repository
        logger.info("Cloning Eliza repository...")
        if not run_command("git clone https://github.com/ai16z/eliza.git"):
            return

        eliza_path = os.path.abspath("eliza")
        plugin_path = os.path.join(eliza_path, "packages", "plugin-trading-assistant")

        # Create plugin directory and copy files
        logger.info("Setting up trading assistant plugin...")
        os.makedirs(plugin_path, exist_ok=True)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        shutil.copytree(current_dir, plugin_path, dirs_exist_ok=True)

        # Modify package.json
        logger.info("Modifying package.json...")
        if not modify_package_json(eliza_path):
            return

        # Replace index.ts with backup
        logger.info("Updating index.ts...")
        shutil.copy2(
            os.path.join(current_dir, "index.ts.backup"),
            os.path.join(eliza_path, "agent", "src", "index.ts")
        )

        # Create character file
        logger.info("Creating character file...")
        create_character_file(plugin_path)

        # Install dependencies and build
        logger.info("Installing dependencies and building project...")
        if not run_command("pnpm install && pnpm build", cwd=eliza_path):
            return

        logger.info("""
Installation completed successfully!
To start the agent, run:
cd eliza
pnpm run start --character='characters/quantai.character.json'
""")

    except Exception as e:
        logger.error(f"Installation failed: {e}")

if __name__ == "__main__":
    main()
