#!/bin/bash

# Define the path to your input file
input_file="/Users/joaocarlinho/gauntlet/24hr-mvp/collabcanvas-mvp-day7/branches.txt"

# Check if the file exists
if [[ ! -f "$input_file" ]]; then
    echo "Error: Input file '$input_file' not found."
    exit 1
fi

echo "Reading file '$input_file' line by line:"

# Read the file line by line
while IFS= read -r line; do
    # 'line' is the script variable holding the current line from the file
    echo "Processing line: $line"
    git branch -D "$line"
    
    # You can perform further operations with the 'line' variable here
    # For example, you could store it in an array, or manipulate it
    # my_array+=("$line") 
    # processed_line=$(echo "$line" | tr 'a-z' 'A-Z') 
    # echo "Processed line: $processed_line"

done < "$input_file"

echo "Finished reading the file."