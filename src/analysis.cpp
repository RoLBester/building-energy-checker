#include "analysis.hpp"

#include <algorithm>
#include <charconv>
#include <chrono>
#include <cmath>
#include <iomanip>
#include <optional>
#include <sstream>
#include <unordered_set>
#include <vector>

namespace energy {
namespace {

using Fields = std::vector<std::string>;

// Each observation occupies one line. A broken quote rejects only that row.
std::optional<Fields> csv_fields(std::string_view line) {
    if (line.ends_with('\r')) line.remove_suffix(1);
    Fields fields;
    for (;;) {
        auto& field = fields.emplace_back();
        if (line.starts_with('"')) {
            line.remove_prefix(1);
            for (;;) {
                const auto quote = line.find('"');
                if (quote == line.npos) return std::nullopt;
                field.append(line.substr(0, quote));
                line.remove_prefix(quote + 1);
                if (!line.starts_with('"')) break;
                field += '"';  // Two quotes inside a quoted field mean one quote.
                line.remove_prefix(1);
            }
        } else {
            const auto end = line.find_first_of(",\"");
            field = line.substr(0, end);
            line.remove_prefix(field.size());
        }
        if (line.empty()) return fields;
        if (line.front() != ',') return std::nullopt;
        line.remove_prefix(1);
    }
}

std::optional<double> watt_hours(std::string_view text) {
    const auto first = text.find_first_not_of(" \t");
    if (first == text.npos) return std::nullopt;
    text = text.substr(first, text.find_last_not_of(" \t") - first + 1);
    if (text.starts_with('+')) {
        text.remove_prefix(1);
        if (text.starts_with('-')) return std::nullopt;
    }
    double value = 0;
    const char* end = text.data() + text.size();
    const auto result = std::from_chars(text.data(), end, value);
    if (result.ec != std::errc{} || result.ptr != end ||
        !std::isfinite(value) || value < 0) return std::nullopt;
    return value;
}

// Check the full timestamp before using its clock hour as a bucket.
std::optional<unsigned> validated_hour(std::string_view text) {
    constexpr std::string_view pattern = "0000-00-00 00:00:00";
    if (text.size() != pattern.size()) return std::nullopt;
    for (std::size_t i = 0; i < text.size(); ++i) {
        if (pattern[i] == '0') {
            if (text[i] < '0' || text[i] > '9') return std::nullopt;
        } else if (text[i] != pattern[i]) {
            return std::nullopt;
        }
    }
    auto number = [&](std::size_t pos, std::size_t count) {
        int value = 0;
        std::from_chars(text.data() + pos, text.data() + pos + count, value);
        return value;
    };
    const auto year = std::chrono::year{number(0, 4)};
    const auto date = year / number(5, 2) / number(8, 2);
    const auto hour = number(11, 2);
    if (int(year) == 0 || !date.ok() || hour >= 24 ||
        number(14, 2) >= 60 || number(17, 2) >= 60) return std::nullopt;
    return static_cast<unsigned>(hour);
}

}  // namespace

std::string Day::formatted_kwh() const {
    std::ostringstream output;
    output << std::fixed << std::setprecision(3) << observed_kwh();
    return output.str();
}

Report analyze(std::istream& input, std::string_view high_wh) {
    Report report;
    const auto threshold = watt_hours(high_wh);
    if (!threshold) {
        report.error = "The high-reading threshold must be a finite, non-negative number in Wh.";
        return report;
    }

    std::string line;
    if (!std::getline(input, line) && input.bad()) {
        report.error = "Could not read the CSV file.";
        return report;
    }
    std::string_view header_line = line;
    if (header_line.starts_with("\xEF\xBB\xBF")) header_line.remove_prefix(3);
    const auto header = csv_fields(header_line);
    if (!header || std::ranges::count(*header, "date") != 1 ||
        std::ranges::count(*header, "Appliances") != 1) {
        report.error = "The CSV header must contain one date column and one Appliances column.";
        return report;
    }
    const auto date_col = std::ranges::find(*header, "date") - header->begin();
    const auto wh_col = std::ranges::find(*header, "Appliances") - header->begin();

    std::unordered_set<std::string> seen;
    while (std::getline(input, line)) {
        const auto fields = csv_fields(line);
        if (!fields || fields->size() != header->size()) {
            ++report.rejected;
            continue;
        }
        const auto& timestamp = (*fields)[date_col];
        const auto wh = watt_hours((*fields)[wh_col]);
        const auto hour = validated_hour(timestamp);
        if (!wh || !hour) {
            ++report.rejected;
            continue;
        }
        // An invalid row cannot claim a timestamp ahead of a valid observation.
        if (!seen.insert(timestamp).second) {
            ++report.duplicates;
            continue;
        }
        auto& day = report.days[timestamp.substr(0, 10)];
        day.watt_hours += *wh;
        if (!std::isfinite(day.watt_hours)) {
            report.error = "The daily Wh total exceeds the numeric range.";
            return report;
        }
        ++day.valid_readings;
        day.hours[*hour].watt_hours += *wh;
        ++day.hours[*hour].readings;
        if (*wh >= *threshold) ++day.high_readings;
        ++report.accepted;
    }
    if (input.bad()) report.error = "Could not finish reading the CSV file.";
    else if (report.accepted == 0) report.error = "The CSV contains no valid observations.";
    return report;
}

}  // namespace energy
