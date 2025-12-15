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
      echo "    ✓ Copied successfully"
      echo "    Files in target: $(ls -1 "$TARGET_PATH" | head -5 | tr '\n' ' ')"
    fi
  done
fi

# 3. List files in .prisma/client to verify structure
echo "Files in /app/node_modules/.prisma/client:"
ls -la /app/node_modules/.prisma/client/ | head -10

# Check if any critical files exist (index.js, index.d.ts, or default.js)
if [ ! -f "/app/node_modules/.prisma/client/index.js" ] && \
   [ ! -f "/app/node_modules/.prisma/client/index.d.ts" ] && \
   [ ! -f "/app/node_modules/.prisma/client/default.js" ]; then
  echo "WARNING: No standard Prisma Client files found, but continuing..."
  echo "Available files:"
  find /app/node_modules/.prisma/client -type f | head -10
fi

echo "✓ Prisma Client setup complete!"
echo ""

# Execute the main command
exec "$@"

