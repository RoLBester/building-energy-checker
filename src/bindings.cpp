#include "analysis.hpp"

#include <emscripten/bind.h>
#include <sstream>

namespace {

emscripten::val analyze_csv(const std::string& csv, const std::string& threshold) {
    std::istringstream input(csv);
    const auto report = energy::analyze(input, threshold);
    auto result = emscripten::val::object();
    result.set("error", report.error);
    result.set("accepted", report.accepted);
    result.set("rejected", report.rejected);
    result.set("duplicates", report.duplicates);
    auto days = emscripten::val::array();
    for (const auto& [date, day] : report.days) {
        auto row = emscripten::val::object();
        row.set("date", date);
        row.set("validReadings", day.valid_readings);
        row.set("observedKwh", day.observed_kwh());
        row.set("formattedKwh", day.formatted_kwh());
        row.set("highReadings", day.high_readings);
        days.call<void>("push", row);
    }
    result.set("days", days);
    return result;
}

}  // namespace

EMSCRIPTEN_BINDINGS(energy_checker) {
    emscripten::function("analyze", &analyze_csv);
}
