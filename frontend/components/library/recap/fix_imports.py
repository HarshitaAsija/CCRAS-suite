import os
import re

recap_root = os.getcwd()  # current working directory is the recap feature root

# Walk through the directory
for root, dirs, files in os.walk(recap_root):
    for file in files:
        if file.endswith('.tsx'):
            file_path = os.path.join(root, file)
            with open(file_path, 'r') as f:
                content = f.read()

            # Function to replace a match
            def replace_match(match):
                # match.group(0) is the entire matched string, e.g., "'@/lib/api'"
                # match.group(1) is the quote character
                # match.group(2) is the part after '@/' until the next quote or space
                quote = match.group(1)
                inner = match.group(2)  # this is the string after '@/' and before the quote
                # Compute relative path from the current file's directory to the recap_root
                rel_path = os.path.relpath(recap_root, root)
                # If rel_path is '.', then we don't want to add a leading './'
                if rel_path == '.':
                    new_path = './' + inner
                else:
                    new_path = os.path.join(rel_path, inner).replace('\\', '/')
                # Return the quoted string
                return quote + new_path + quote

            # Pattern to match: a quote, then '@/', then any non-quote, non-space characters, then the same quote
            pattern = r"(['\"])@/([^'\"\s]+)\1"
            new_content = re.sub(pattern, replace_match, content)

            # Write back if changed
            if new_content != content:
                with open(file_path, 'w') as f:
                    f.write(new_content)
                print(f"Updated: {file_path}")

print("Import fixing complete.")