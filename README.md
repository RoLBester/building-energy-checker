# Building Energy Checker

A C++23 command-line tool and React dashboard for reviewing daily appliance energy. Both use the same C++ parser and aggregation code. The dashboard runs it in a WebAssembly worker on your device.

## Build and run

From the project root, build with a C++23 compiler. The native build was tested with Apple Clang 21.

```sh
mkdir -p build
c++ -std=c++23 -O2 -Wall -Wextra -Wpedantic src/analysis.cpp src/main.cpp -o build/energy-checker
./build/energy-checker tests/fixtures/small.csv
./build/energy-checker tests/fixtures/small.csv --high-wh 600
sh tests/check.sh
```

For Docker, build the image and mount the input directory read-only. The image builds with GCC 15.2.

```sh
docker build -t building-energy-checker .
docker run --rm -v "$PWD/tests/fixtures:/input:ro" building-energy-checker /input/small.csv
```

## Input and results

`energy-checker <input.csv> [--high-wh <threshold>]` reads one record per line. The header must include `date` and `Appliances` in any order. Dates use `YYYY-MM-DD HH:MM:SS`. Appliances are Wh per observation. Quoted fields, doubled quotes, LF and CRLF are supported.

The checker rejects malformed rows, mismatched field counts, invalid timestamps, and missing, non-numeric, non-finite or negative readings. It keeps the first valid reading at each timestamp. The threshold must be finite and non-negative. A reading of **500 Wh or more** is flagged for review by default.

Each daily total sums accepted Wh and divides by 1,000. The reading count shows how much was observed on partial days. The fixture prints this CSV to standard output.

```csv
date,valid_readings,observed_kwh,high_readings
2016-01-11,2,0.610,1
2016-01-12,1,0.080,0
```

Standard error reports `3 accepted, 2 rejected, 1 duplicate`. At 600 Wh both high counts are zero. Invalid arguments, file or header errors, and files with no valid observations return a nonzero exit code.

## Dashboard

Use Node.js **24.22.3** and Emscripten **4.0.23**. To install the SDK inside the checkout, run these commands once.

```sh
mkdir -p .local/tools
git clone --depth 1 --branch 4.0.23 https://github.com/emscripten-core/emsdk.git .local/tools/emsdk
.local/tools/emsdk/emsdk install 4.0.23
.local/tools/emsdk/emsdk activate 4.0.23
```

With Node on your path, build the C++ engine and the locked TypeScript frontend. Open the local address printed by Vite.

```sh
source .local/tools/emsdk/emsdk_env.sh
sh scripts/build-wasm.sh
cd web
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Choose a CSV or use the demo, set a threshold and select **Run analysis**. **Date range** filters the summary, chart and table. Select a bar to inspect a day. File quality counts cover the whole file.

## Dataset

Luis M. Candanedo’s appliance measurements were logged every 10 minutes. The demo keeps the date and appliance columns for 11–17 January 2016, with numeric padding removed. Its 906 readings total 110.490 kWh. The first day starts at 17:00. [UCI Appliances Energy Prediction](https://archive.ics.uci.edu/dataset/374/appliances+energy+prediction) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

To reproduce the full-data run, use the project root.

```sh
mkdir -p data
curl --fail --location --silent --show-error --retry 2 'https://archive.ics.uci.edu/static/public/374/appliances%2Benergy%2Bprediction.zip' -o data/appliances.zip
unzip -o data/appliances.zip energydata_complete.csv -d data
./build/energy-checker data/energydata_complete.csv > build/uci-daily.csv
```

At 500 Wh, the full file yields **1,928.010 kWh** over 138 dates, with 19,735 accepted readings, 301 high readings, zero rejected rows and zero duplicates.
