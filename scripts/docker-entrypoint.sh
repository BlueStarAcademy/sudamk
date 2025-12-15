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

# 3. Ensure @prisma/client package is accessible from packages/database/node_modules
#    This is needed because packages/database/dist/client.js imports from '@prisma/client'
#    and Node.js ESM resolver looks in packages/database/node_modules/@prisma/client
echo "Setting up @prisma/client in packages/database/node_modules..."
if [ ! -d "/app/packages/database/node_modules/@prisma/client" ]; then
  echo "  Creating packages/database/node_modules/@prisma/client..."
  mkdir -p /app/packages/database/node_modules/@prisma
  
  # Find @prisma/client package from root node_modules or .pnpm store
  if [ -d "/app/node_modules/@prisma/client" ]; then
    cp -r /app/node_modules/@prisma/client /app/packages/database/node_modules/@prisma/client
    echo "  ✓ Copied from /app/node_modules/@prisma/client"
  elif [ -d "/app/node_modules/.pnpm" ]; then
    PRISMA_PNPM=$(find /app/node_modules/.pnpm -type d -name "@prisma+client@*" 2>/dev/null | head -1)
    if [ -n "$PRISMA_PNPM" ] && [ -d "$PRISMA_PNPM/node_modules/@prisma/client" ]; then
      cp -r "$PRISMA_PNPM/node_modules/@prisma/client" /app/packages/database/node_modules/@prisma/client
      echo "  ✓ Copied from $PRISMA_PNPM/node_modules/@prisma/client"
    else
      echo "  WARNING: Could not find @prisma/client package to copy"
    fi
  fi
fi

# 4. Ensure .prisma/client exists in packages/database/node_modules/@prisma/client
if [ -d "/app/packages/database/node_modules/@prisma/client" ]; then
  echo "  Setting up .prisma/client in packages/database/node_modules/@prisma/client..."
  mkdir -p /app/packages/database/node_modules/@prisma/client/.prisma
  rm -rf /app/packages/database/node_modules/@prisma/client/.prisma/client
  cp -r "$GENERATED_PATH" /app/packages/database/node_modules/@prisma/client/.prisma/client
  echo "  ✓ Copied Prisma Client to packages/database/node_modules/@prisma/client/.prisma/client"
fi

# 5. List files in .prisma/client to verify structure
echo ""
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

echo ""
echo "✓ Prisma Client setup complete!"
echo ""

# Execute the main command
exec "$@"

