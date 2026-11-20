#pragma once

#include <array>
#include <cstddef>
#include <istream>
#include <map>
#include <string>
#include <string_view>

namespace energy {

struct Hour {
    double watt_hours = 0;
    std::size_t readings = 0;
};

struct Day {
    std::size_t valid_readings = 0;
    double watt_hours = 0;
    std::size_t high_readings = 0;
    std::array<Hour, 24> hours{};

    double observed_kwh() const { return watt_hours / 1000.0; }
    std::string formatted_kwh() const;
};

struct Report {
    std::map<std::string, Day> days;  // ISO dates sort in calendar order.
    std::size_t accepted = 0;
    std::size_t rejected = 0;
    std::size_t duplicates = 0;
    std::string error;
};

inline constexpr std::string_view default_high_wh = "500";
Report analyze(std::istream& input, std::string_view high_wh = default_high_wh);

}  // namespace energy
