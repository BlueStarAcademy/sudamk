#!/bin/sh
set -e

echo "=== Prisma Client Setup ==="

GENERATED_PATH="/app/packages/database/generated"

# Check if generated Prisma Client exists
if [ ! -d "$GENERATED_PATH" ]; then
  echo "ERROR: Generated Prisma Client not found at $GENERATED_PATH"
  exit 1
fi

echo "✓ Found generated Prisma Client at $GENERATED_PATH"

# 1. Copy to node_modules/.prisma/client (standard location)
echo "Copying to node_modules/.prisma/client..."
mkdir -p /app/node_modules/.prisma
rm -rf /app/node_modules/.prisma/client
cp -r "$GENERATED_PATH" /app/node_modules/.prisma/client
echo "✓ Copied to node_modules/.prisma/client"

# 2. Copy to all @prisma/client instances in .pnpm store
if [ -d "/app/node_modules/.pnpm" ]; then
  echo "Searching for @prisma/client in .pnpm store..."
  find /app/node_modules/.pnpm -type d -name "@prisma+client@*" 2>/dev/null | while read PRISMA_PNPM_DIR; do
    if [ -d "$PRISMA_PNPM_DIR/node_modules/@prisma/client" ]; then
      TARGET_PATH="$PRISMA_PNPM_DIR/node_modules/.prisma/client"
      echo "  Copying to $TARGET_PATH..."
      mkdir -p "$(dirname "$TARGET_PATH")"
      rm -rf "$TARGET_PATH"
      cp -r "$GENERATED_PATH" "$TARGET_PATH"
      if [ -f "$TARGET_PATH/index.js" ]; then
        echo "    ✓ Copied successfully"
      else
        echo "    ✗ ERROR: index.js not found after copy"
      fi
    fi
  done
fi

# 3. Verify critical file exists
if [ ! -f "/app/node_modules/.prisma/client/index.js" ]; then
  echo "ERROR: index.js not found at /app/node_modules/.prisma/client/index.js"
  exit 1
fi

echo "✓ Prisma Client setup complete!"
echo ""

# Execute the main command
exec "$@"

