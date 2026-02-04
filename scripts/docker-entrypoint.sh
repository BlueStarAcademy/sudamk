#!/bin/sh
set -e

echo "=========================================="
echo "=== Prisma Client Setup Script Start ==="
echo "=========================================="

cd /app

# Step 1: Generate Prisma Client using pnpm
echo "Step 1: Generating Prisma Client..."
if command -v pnpm >/dev/null 2>&1; then
  echo "Using pnpm to generate Prisma Client..."
  pnpm --filter @sudam/database exec prisma generate || {
    echo "pnpm prisma generate failed, trying direct prisma..."
    cd packages/database
    if [ -f "/app/node_modules/.bin/prisma" ]; then
      /app/node_modules/.bin/prisma generate
    else
      npx prisma generate
    fi
    cd /app
  }
else
  echo "pnpm not found, using direct prisma..."
  cd packages/database
  if [ -f "/app/node_modules/.bin/prisma" ]; then
    /app/node_modules/.bin/prisma generate
  else
    npx prisma generate
  fi
  cd /app
fi

# Step 2: Find generated Prisma Client
echo ""
echo "Step 2: Locating generated Prisma Client..."
GENERATED_PATH=""
if [ -d "/app/node_modules/.prisma/client" ]; then
  GENERATED_PATH="/app/node_modules/.prisma/client"
  echo "✓ Found at: $GENERATED_PATH"
elif [ -d "/app/packages/database/node_modules/.prisma/client" ]; then
  GENERATED_PATH="/app/packages/database/node_modules/.prisma/client"
  echo "✓ Found at: $GENERATED_PATH"
else
  echo "ERROR: Prisma Client not found after generation"
  find /app -type d -name ".prisma" 2>/dev/null | head -10
  exit 1
fi

# Verify critical files exist
if [ ! -f "$GENERATED_PATH/index.js" ] && [ ! -f "$GENERATED_PATH/index.d.ts" ] && [ ! -f "$GENERATED_PATH/default.js" ]; then
  echo "WARNING: Standard Prisma Client files not found"
  ls -la "$GENERATED_PATH" | head -10
fi

# Step 3: Copy to all @prisma/client instances in .pnpm store
echo ""
echo "Step 3: Copying to all @prisma/client instances in .pnpm store..."
if [ -d "/app/node_modules/.pnpm" ]; then
  PRISMA_COUNT=0
  for PRISMA_PNPM_DIR in $(find /app/node_modules/.pnpm -type d -name "@prisma+client@*" 2>/dev/null); do
    if [ -d "$PRISMA_PNPM_DIR/node_modules/@prisma/client" ]; then
      TARGET_PATH="$PRISMA_PNPM_DIR/node_modules/.prisma/client"
      echo "  [$PRISMA_COUNT] Processing: $PRISMA_PNPM_DIR"
      mkdir -p "$(dirname "$TARGET_PATH")"
      rm -rf "$TARGET_PATH"
      cp -r "$GENERATED_PATH" "$TARGET_PATH"
      PRISMA_COUNT=$((PRISMA_COUNT + 1))
    fi
  done
  echo "  ✓ Copied to $PRISMA_COUNT @prisma/client instances"
else
  echo "  No .pnpm directory found"
fi

# Step 4: Ensure .prisma/client exists in root node_modules
echo ""
echo "Step 4: Ensuring .prisma/client in root node_modules..."
if [ "$GENERATED_PATH" = "/app/node_modules/.prisma/client" ]; then
  echo "  ✓ Prisma Client already at /app/node_modules/.prisma/client (skipping copy)"
else
  mkdir -p /app/node_modules/.prisma
  rm -rf /app/node_modules/.prisma/client
  cp -r "$GENERATED_PATH" /app/node_modules/.prisma/client
  echo "  ✓ Copied to /app/node_modules/.prisma/client"
fi

# Step 5: Ensure @prisma/client and .prisma/client in packages/database/node_modules
echo ""
echo "Step 5: Setting up @prisma/client in packages/database/node_modules..."
if [ ! -d "/app/packages/database/node_modules/@prisma/client" ]; then
  mkdir -p /app/packages/database/node_modules/@prisma
  
  # Copy @prisma/client package
  if [ -d "/app/node_modules/.pnpm" ]; then
    PRISMA_PNPM=$(find /app/node_modules/.pnpm -type d -name "@prisma+client@*" 2>/dev/null | head -1)
    if [ -n "$PRISMA_PNPM" ] && [ -d "$PRISMA_PNPM/node_modules/@prisma/client" ]; then
      cp -r "$PRISMA_PNPM/node_modules/@prisma/client" /app/packages/database/node_modules/@prisma/client
      echo "  ✓ Copied @prisma/client package"
    fi
  fi
fi

# Copy .prisma/client to packages/database/node_modules/@prisma/client
if [ -d "/app/packages/database/node_modules/@prisma/client" ]; then
  mkdir -p /app/packages/database/node_modules/@prisma/client/.prisma
  rm -rf /app/packages/database/node_modules/@prisma/client/.prisma/client
  cp -r "$GENERATED_PATH" /app/packages/database/node_modules/@prisma/client/.prisma/client
  echo "  ✓ Copied .prisma/client to packages/database/node_modules/@prisma/client/.prisma/client"
fi

echo ""
echo "=========================================="
echo "✓ Prisma Client setup complete!"
echo "=========================================="
echo ""

# Execute the main command
exec "$@"
