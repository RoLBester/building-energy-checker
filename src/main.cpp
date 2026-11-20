#include "analysis.hpp"

#include <fstream>
#include <iostream>

int main(int argc, char* argv[]) {
    if ((argc != 2 && argc != 4) ||
        (argc == 4 && std::string_view{argv[2]} != "--high-wh")) {
        std::cerr << "Usage: energy-checker <input.csv> [--high-wh <threshold>]\n";
        return 2;
    }
    std::ifstream input(argv[1], std::ios::binary);
    if (!input) {
        std::cerr << "Could not open input file: " << argv[1] << '\n';
        return 1;
    }
    const auto threshold = argc == 4 ? std::string_view{argv[3]} : energy::default_high_wh;
    const auto report = energy::analyze(input, threshold);
    std::cerr << report.accepted << " accepted, " << report.rejected << " rejected, "
              << report.duplicates << (report.duplicates == 1 ? " duplicate\n" : " duplicates\n");
    if (!report.error.empty()) {
        std::cerr << report.error << '\n';
        return 1;
    }
    std::cout << "date,valid_readings,observed_kwh,high_readings\n";
    for (const auto& [date, day] : report.days) {
        std::cout << date << ',' << day.valid_readings << ',' << day.formatted_kwh()
                  << ',' << day.high_readings << '\n';
    }
}
