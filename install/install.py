import os
import subprocess
import json
import shutil
from pathlib import Path
import logging
import base64

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

def get_base64_cookies():
    """Get base64 encoded cookies and decode them"""
    logger.info("Please enter your Twitter cookies as a base64 encoded string (press Enter to skip)")
    logger.info("Tip: Use a base64 encoder to convert your cookies JSON to base64 first")

    encoded_cookies = input("Base64 Twitter Cookies: ").strip()
    if not encoded_cookies:
        return ""

    try:
        decoded_cookies = base64.b64decode(encoded_cookies).decode('utf-8')
        # Validate that it's a valid JSON string
        json.loads(decoded_cookies)
        return decoded_cookies
    except Exception as e:
        logger.error(f"Failed to decode cookies: {e}")
        logger.info("Continuing with empty cookies...")
        return ""

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

def create_character_file(eliza_path, plugin_root):
    """Copy and update the character file with user inputs"""
    character_file_path = os.path.join(plugin_root, "characters", "quantai.character.json")

    try:
        with open(character_file_path, 'r') as f:
            character_data = json.load(f)

        # Update the secrets with user input
        character_data["settings"]["secrets"]["TRADING_DB_URL"] = get_postgres_url()
        character_data["settings"]["secrets"]["OPENAI_API_KEY"] = get_user_input("OpenAI API Key")
        character_data["settings"]["secrets"]["TELEGRAM_BOT_TOKEN"] = get_user_input("Telegram Bot Token")

        # Update Twitter settings
        character_data["settings"]["TWITTER_USERNAME"] = get_user_input("Twitter Username")
        character_data["settings"]["TWITTER_PASSWORD"] = get_user_input("Twitter Password")
        character_data["settings"]["TWITTER_EMAIL"] = get_user_input("Twitter Email")
        character_data["settings"]["TWITTER_COOKIES"] = get_base64_cookies()

        # Create characters directory in eliza root
        characters_dir = os.path.join(eliza_path, "characters")
        os.makedirs(characters_dir, exist_ok=True)

        # Save the updated character file
        output_path = os.path.join(characters_dir, "quantai.character.json")
        with open(output_path, 'w') as f:
            json.dump(character_data, f, indent=4)

        logger.info(f"Character file created at {output_path}")

    except Exception as e:
        logger.error(f"Failed to create character file: {e}")
        raise

def main():
    try:
        # Clone Eliza repository if not already cloned
        logger.info("Cloning Eliza repository...")
        if not os.path.exists("eliza"):
            if not run_command("git clone https://github.com/ai16z/eliza.git"):
                return

        eliza_path = os.path.abspath("eliza")
        plugin_path = os.path.join(eliza_path, "packages", "plugin-trading-assistant")

        # Create plugin directory and copy files
        logger.info("Setting up trading assistant plugin...")
        os.makedirs(plugin_path, exist_ok=True)

        # Get the plugin root directory (parent of install directory)
        current_dir = os.path.dirname(os.path.abspath(__file__))  # install directory
        plugin_root = os.path.dirname(current_dir)  # parent directory

        # Define items to exclude from copying
        exclude_patterns = [
            'eliza',  # exclude cloned eliza directory
            '__pycache__',
            '*.pyc',
            '.git',
            'node_modules'
        ]

        def ignore_patterns(path, names):
            ignored = set()
            for pattern in exclude_patterns:
                for name in names:
                    if pattern in name or (pattern.startswith('*') and name.endswith(pattern[1:])):
                        ignored.add(name)
            return ignored

        # Copy plugin files
        for item in os.listdir(plugin_root):
            src = os.path.join(plugin_root, item)
            dst = os.path.join(plugin_path, item)

            # Skip excluded items
            if any(pattern in item for pattern in exclude_patterns):
                continue

            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True, ignore=ignore_patterns)
            else:
                shutil.copy2(src, dst)

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
        create_character_file(eliza_path, plugin_root)

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
