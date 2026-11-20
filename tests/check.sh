#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
checker=${1:-./build/energy-checker}
mkdir -p build
tmp=$(mktemp -d build/test.XXXXXX)
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/default.csv" <<'CSV'
date,valid_readings,observed_kwh,high_readings
2016-01-11,2,0.610,1
2016-01-12,1,0.080,0
CSV
sed 's/0.610,1/0.610,0/' "$tmp/default.csv" > "$tmp/600.csv"
for threshold in default 600; do
    set -- tests/fixtures/small.csv
    if [ "$threshold" = 600 ]; then set -- "$@" --high-wh 600; fi
    "$checker" "$@" > "$tmp/out" 2> "$tmp/err"
    diff -u "$tmp/$threshold.csv" "$tmp/out"
    grep -Fxq '3 accepted, 2 rejected, 1 duplicate' "$tmp/err"
done

# Reordered columns, escaped quotes, CRLF, inclusive threshold and row recovery.
cat > "$tmp/edge.csv" <<'CSV'
"note","Appliances","date"
invalid first,-2,2016-02-29 12:00:00
"meter, ""west"""," 500",2016-02-29 12:00:00
duplicate,0,2016-02-29 12:00:00
invalid duplicate,NaN,2016-02-29 12:00:00
bad day,25,2017-02-29 00:00:00
bad time,25,2016-01-01 24:00:00
short,25
"broken,25,2016-01-02 00:00:00
earlier,2.5e1,2016-01-01 00:00:00
CSV
awk '{printf "%s\r\n", $0}' "$tmp/edge.csv" > "$tmp/crlf.csv"
"$checker" "$tmp/crlf.csv" > "$tmp/out" 2> "$tmp/err"
cat > "$tmp/expected" <<'CSV'
date,valid_readings,observed_kwh,high_readings
2016-01-01,1,0.025,0
2016-02-29,1,0.500,1
CSV
diff -u "$tmp/expected" "$tmp/out"
grep -Fxq '2 accepted, 6 rejected, 1 duplicate' "$tmp/err"

fails_with() {
    message=$1
    shift
    if "$checker" "$@" > "$tmp/out" 2> "$tmp/err"; then
        echo "Expected failure for $*" >&2
        exit 1
    fi
    test ! -s "$tmp/out"
    grep -Fq "$message" "$tmp/err"
}
printf 'date,lights\n' > "$tmp/missing.csv"
fails_with 'Appliances column' "$tmp/missing.csv"
printf 'Appliances,date\nInfinity,2016-02-29 00:00:00\n' > "$tmp/invalid.csv"
fails_with 'no valid observations' "$tmp/invalid.csv"
for value in -1 NaN inf 1x ''; do
    fails_with 'finite, non-negative' tests/fixtures/small.csv --high-wh "$value"
done
fails_with 'Could not open' "$tmp/absent.csv"
fails_with 'Usage:' tests/fixtures/small.csv --other 50
echo 'All CLI checks passed.'
