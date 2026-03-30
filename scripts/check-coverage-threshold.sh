#!/bin/bash
# Check coverage thresholds from Bun lcov output
# Usage: ./scripts/check-coverage-threshold.sh coverage/lcov.info 95 90
# Args: lcov_file total_threshold per_file_threshold

LCOV_FILE="${1:-coverage/lcov.info}"
TOTAL_THRESHOLD="${2:-95}"
FILE_THRESHOLD="${3:-90}"

if [ ! -f "$LCOV_FILE" ]; then
  echo "Coverage file not found: $LCOV_FILE"
  exit 1
fi

# Parse lcov: count total lines hit / total lines found
TOTAL_HIT=0
TOTAL_FOUND=0
FAILED_FILES=""
CURRENT_FILE=""
FILE_HIT=0
FILE_FOUND=0

while IFS= read -r line; do
  case "$line" in
    SF:*)
      CURRENT_FILE="${line#SF:}"
      FILE_HIT=0
      FILE_FOUND=0
      ;;
    LH:*)
      FILE_HIT="${line#LH:}"
      ;;
    LF:*)
      FILE_FOUND="${line#LF:}"
      ;;
    end_of_record)
      if [ "$FILE_FOUND" -gt 0 ]; then
        TOTAL_HIT=$((TOTAL_HIT + FILE_HIT))
        TOTAL_FOUND=$((TOTAL_FOUND + FILE_FOUND))
        FILE_PCT=$((FILE_HIT * 100 / FILE_FOUND))
        if [ "$FILE_PCT" -lt "$FILE_THRESHOLD" ]; then
          FAILED_FILES="$FAILED_FILES\n  $CURRENT_FILE: ${FILE_PCT}% (need ${FILE_THRESHOLD}%)"
        fi
      fi
      ;;
  esac
done < "$LCOV_FILE"

# Total coverage
if [ "$TOTAL_FOUND" -eq 0 ]; then
  echo "No coverage data found"
  exit 1
fi

TOTAL_PCT=$((TOTAL_HIT * 100 / TOTAL_FOUND))

echo "=== Coverage Report ==="
echo "Total: ${TOTAL_PCT}% (${TOTAL_HIT}/${TOTAL_FOUND} lines)"
echo "Threshold: ${TOTAL_THRESHOLD}% total, ${FILE_THRESHOLD}% per file"

EXIT_CODE=0

if [ "$TOTAL_PCT" -lt "$TOTAL_THRESHOLD" ]; then
  echo "FAIL: Total coverage ${TOTAL_PCT}% < ${TOTAL_THRESHOLD}%"
  EXIT_CODE=1
else
  echo "PASS: Total coverage ${TOTAL_PCT}% >= ${TOTAL_THRESHOLD}%"
fi

if [ -n "$FAILED_FILES" ]; then
  echo -e "\nFiles below ${FILE_THRESHOLD}%:$FAILED_FILES"
  EXIT_CODE=1
fi

exit $EXIT_CODE
