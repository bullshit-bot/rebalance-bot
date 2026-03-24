#!/bin/bash
# Run mock.module test files in isolated bun processes to avoid module cache pollution.
# Each file gets its own process so mock.module() doesn't affect other tests.
# Merges all lcov outputs into coverage/lcov-merged.info

set -e
COVERAGE_DIR="coverage/isolated"
MERGED="coverage/lcov-merged.info"
mkdir -p "$COVERAGE_DIR"

# Find all *.isolated.test.ts files
ISOLATED_FILES=$(find src -name "*.isolated.test.ts" 2>/dev/null)

if [ -z "$ISOLATED_FILES" ]; then
  echo "No isolated test files found. Skipping."
  exit 0
fi

echo "Running isolated tests..."
i=0
for f in $ISOLATED_FILES; do
  i=$((i+1))
  echo "  [$i] $f"
  bun test "$f" --coverage --coverage-reporter=lcov --coverage-dir="$COVERAGE_DIR/$i" 2>/dev/null || true
done

# Merge all lcov files
echo "Merging lcov files..."
LCOV_FILES=""
for d in "$COVERAGE_DIR"/*/; do
  if [ -f "$d/lcov.info" ]; then
    LCOV_FILES="$LCOV_FILES -a $d/lcov.info"
  fi
done

if [ -n "$LCOV_FILES" ]; then
  # Also include the main coverage
  if [ -f "coverage/lcov.info" ]; then
    LCOV_FILES="-a coverage/lcov.info $LCOV_FILES"
  fi
  lcov $LCOV_FILES -o "$MERGED" --quiet 2>/dev/null
  echo "Merged coverage: $MERGED"
  genhtml "$MERGED" -o coverage/html --quiet
  echo "HTML report: coverage/html/index.html"
else
  echo "No lcov files to merge."
fi
