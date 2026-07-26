#!/bin/bash
export NVM_DIR="$HOME/.nvm"
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$(dirname "$0")/.."
exec npm run dev
