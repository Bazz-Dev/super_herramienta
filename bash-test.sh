#!/bin/bash
# test both path styles
echo "hello" > "/mnt/c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/bash-result.txt" 2>/dev/null || \
echo "hello" > "/c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/bash-result.txt" 2>/dev/null || \
echo "no write succeeded"
