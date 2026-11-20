FROM alpine:3.23 AS build
RUN apk add --no-cache g++
WORKDIR /src
COPY src/analysis.hpp src/analysis.cpp src/main.cpp ./
RUN g++ -std=c++23 -O2 -Wall -Wextra -Wpedantic analysis.cpp main.cpp -o /energy-checker

FROM alpine:3.23
RUN apk add --no-cache libstdc++
COPY --from=build /energy-checker /usr/local/bin/energy-checker
USER nobody
ENTRYPOINT ["energy-checker"]
