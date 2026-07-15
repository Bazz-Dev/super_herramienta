#!/bin/bash
set -e
echo "START" > /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt
which node >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt 2>&1 || echo "node not found" >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt
which npx >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt 2>&1 || echo "npx not found" >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt
node --version >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt 2>&1
echo "END" >> /c/Users/sehci/OneDrive/Desktop/SuperHerramienta_ingegar/migrate-result.txt
