#!/bin/sh
# Don't use set -e, we want to continue even if some steps fail

echo "=========================================="
echo "=== Prisma Client Setup Script Start ==="
echo "=========================================="

# Check if we need to regenerate Prisma Client
# This ensures Prisma Client is always in the correct location
if [ -d "/app/packages/database" ] && [ -f "/app/packages/database/schema.prisma" ]; then
  echo "Running prisma generate to ensure Prisma Client is properly initialized..."
  echo "Current directory: $(pwd)"
  echo "Checking for prisma CLI..."
  
  cd /app/packages/database
  
  PRISMA_CMD=""
  
  # Try to use prisma from node_modules
  if [ -f "/app/node_modules/.bin/prisma" ]; then
    PRISMA_CMD="/app/node_modules/.bin/prisma"
    echo "Found prisma at: $PRISMA_CMD"
  elif [ -f "/app/node_modules/prisma/cli.js" ]; then
    PRISMA_CMD="node /app/node_modules/prisma/cli.js"
    echo "Found prisma at: /app/node_modules/prisma/cli.js"
  elif command -v pnpm >/dev/null 2>&1 && [ -f "/app/package.json" ]; then
    echo "Using pnpm to run prisma generate..."
    cd /app
    pnpm --filter @sudam/database exec prisma generate 2>&1 || {
      echo "pnpm prisma generate failed, trying direct prisma..."
      cd /app/packages/database
      if [ -f "/app/node_modules/.bin/prisma" ]; then
        PRISMA_CMD="/app/node_modules/.bin/prisma"
      else
        PRISMA_CMD="npx prisma"
      fi
    }
    cd /app/packages/database
  else
    echo "Using npx to run prisma generate..."
    PRISMA_CMD="npx prisma"
  fi
  
  if [ -n "$PRISMA_CMD" ]; then
    echo "Executing: $PRISMA_CMD generate --schema ./schema.prisma"
    $PRISMA_CMD generate --schema ./schema.prisma 2>&1 || {
      echo "ERROR: prisma generate failed with exit code $?"
    }
  fi
  
  cd /app
  echo "✓ Prisma generate attempt completed"
  echo "Checking if generated files exist..."
  find /app -name ".prisma" -type d 2>/dev/null | head -5
  find /app/packages/database -name "generated" -type d 2>/dev/null | head -5
else
  echo "WARNING: /app/packages/database or schema.prisma not found"
fi

# Find generated Prisma Client (default location after prisma generate)
GENERATED_PATH=""
if [ -d "/app/node_modules/.prisma/client" ]; then
  GENERATED_PATH="/app/node_modules/.prisma/client"
  echo "✓ Found generated Prisma Client at $GENERATED_PATH"
elif [ -d "/app/packages/database/node_modules/.prisma/client" ]; then
  GENERATED_PATH="/app/packages/database/node_modules/.prisma/client"
  echo "✓ Found generated Prisma Client at $GENERATED_PATH"
elif [ -d "/app/packages/database/generated" ]; then
  GENERATED_PATH="/app/packages/database/generated"
  echo "✓ Found generated Prisma Client at $GENERATED_PATH"
else
  echo "ERROR: Generated Prisma Client not found after generation"
  echo "Searching for .prisma/client directories..."
  find /app -type d -name ".prisma" 2>/dev/null | head -10
  exit 1
fi

# 1. Copy to node_modules/.prisma/client (standard location)
echo "Copying to node_modules/.prisma/client..."
mkdir -p /app/node_modules/.prisma
rm -rf /app/node_modules/.prisma/client
cp -r "$GENERATED_PATH" /app/node_modules/.prisma/client
echo "✓ Copied to node_modules/.prisma/client"

# 2. Copy to all @prisma/client instances in .pnpm store
if [ -d "/app/node_modules/.pnpm" ]; then
  echo ""
  echo "Searching for @prisma/client in .pnpm store..."
  PRISMA_COUNT=0
  for PRISMA_PNPM_DIR in $(find /app/node_modules/.pnpm -type d -name "@prisma+client@*" 2>/dev/null); do
    if [ -d "$PRISMA_PNPM_DIR/node_modules/@prisma/client" ]; then
      TARGET_PATH="$PRISMA_PNPM_DIR/node_modules/.prisma/client"
      echo "  [${PRISMA_COUNT}] Processing: $PRISMA_PNPM_DIR"
      echo "    Target: $TARGET_PATH"
      mkdir -p "$(dirname "$TARGET_PATH")"
      rm -rf "$TARGET_PATH"
      cp -r "$GENERATED_PATH" "$TARGET_PATH"
      
      # Verify copy was successful
      if [ -d "$TARGET_PATH" ]; then
        echo "    ✓ Copied successfully"
        FILE_COUNT=$(find "$TARGET_PATH" -type f | wc -l)
        echo "    File count: $FILE_COUNT"
        if [ -f "$TARGET_PATH/index.js" ]; then
          echo "    ✓ index.js found"
        elif [ -f "$TARGET_PATH/index.d.ts" ]; then
          echo "    ✓ index.d.ts found"
        else
          echo "    WARNING: No index.js or index.d.ts found"
          echo "    First 5 files:"
          find "$TARGET_PATH" -type f | head -5 | sed 's/^/      /'
        fi
      else
        echo "    ✗ ERROR: Copy failed!"
      fi
      PRISMA_COUNT=$((PRISMA_COUNT + 1))
    fi
  done
  echo "  Total @prisma/client instances processed: $PRISMA_COUNT"
else
  echo "  No .pnpm directory found"
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
echo "=========================================="
echo "=== Final Verification ==="
echo "=========================================="

# Verify the specific path that's failing
FAILING_PATH="/app/node_modules/.pnpm/@prisma+client@6.19.1_prisma@6.19.1_typescript@5.9.3/node_modules/.prisma/client"
if [ -d "$FAILING_PATH" ]; then
  echo "✓ Found failing path: $FAILING_PATH"
  echo "  Files in this directory:"
  ls -la "$FAILING_PATH" | head -10
  if [ -f "$FAILING_PATH/index.js" ] || [ -f "$FAILING_PATH/index.d.ts" ]; then
    echo "  ✓ Critical files exist"
  else
    echo "  ✗ WARNING: Critical files missing"
  fi
else
  echo "✗ WARNING: Failing path not found: $FAILING_PATH"
  echo "  Searching for similar paths..."
  find /app/node_modules/.pnpm -type d -path "*@prisma+client@*/.prisma/client" 2>/dev/null | head -5
fi

echo ""
echo "✓ Prisma Client setup complete!"
echo "=========================================="
echo ""

# Execute the main command
exec "$@"

