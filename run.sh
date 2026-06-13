#!/bin/bash

if [ ! -f .setup_complete ]; then
    node setup.js
    if [ $? -ne 0 ]; then
        echo ""
        echo "Kurulum tamamlanamadi. Lutfen uyarilari dikkate aliniz."
        read -p "Cikmak icin Enter'a basin..."
        exit 1
    fi
fi

nodemon --watch src src/main.js
