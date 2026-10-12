/* birds view · geographic reference data for the simulated movement and earth layers.
   Coordinates are approximate public locations; everything moving on them is simulated. */
(function () {
  const BV = (window.BV = window.BV || {});

  // [IATA, city, country code, lat, lon, weight]
  BV.AIRPORTS = [
    ['ATL', 'Atlanta', 'US', 33.64, -84.43, 5], ['LAX', 'Los Angeles', 'US', 33.94, -118.41, 5], ['ORD', 'Chicago', 'US', 41.98, -87.9, 4],
    ['DFW', 'Dallas', 'US', 32.9, -97.04, 4], ['DEN', 'Denver', 'US', 39.86, -104.67, 3], ['JFK', 'New York', 'US', 40.64, -73.78, 5],
    ['SFO', 'San Francisco', 'US', 37.62, -122.38, 4], ['SEA', 'Seattle', 'US', 47.45, -122.31, 3], ['MIA', 'Miami', 'US', 25.79, -80.29, 3],
    ['YYZ', 'Toronto', 'CA', 43.68, -79.63, 3], ['YVR', 'Vancouver', 'CA', 49.19, -123.18, 2], ['MEX', 'Mexico City', 'MX', 19.44, -99.07, 3],
    ['GRU', 'Sao Paulo', 'BR', -23.43, -46.47, 3], ['BOG', 'Bogota', 'CO', 4.7, -74.15, 2], ['LIM', 'Lima', 'PE', -12.02, -77.11, 2],
    ['SCL', 'Santiago', 'CL', -33.39, -70.79, 2], ['EZE', 'Buenos Aires', 'AR', -34.82, -58.54, 2], ['PTY', 'Panama City', 'PA', 9.07, -79.38, 2],
    ['LHR', 'London', 'GB', 51.47, -0.45, 5], ['CDG', 'Paris', 'FR', 49.01, 2.55, 5], ['AMS', 'Amsterdam', 'NL', 52.31, 4.76, 4],
    ['FRA', 'Frankfurt', 'DE', 50.04, 8.56, 4], ['MAD', 'Madrid', 'ES', 40.47, -3.56, 3], ['FCO', 'Rome', 'IT', 41.8, 12.25, 3],
    ['IST', 'Istanbul', 'TR', 41.26, 28.74, 4], ['ZRH', 'Zurich', 'CH', 47.46, 8.55, 2], ['CPH', 'Copenhagen', 'DK', 55.62, 12.65, 2],
    ['HEL', 'Helsinki', 'FI', 60.32, 24.96, 2], ['WAW', 'Warsaw', 'PL', 52.17, 20.97, 2], ['KEF', 'Reykjavik', 'IS', 63.98, -22.6, 1],
    ['DXB', 'Dubai', 'AE', 25.25, 55.36, 5], ['DOH', 'Doha', 'QA', 25.27, 51.61, 3], ['CAI', 'Cairo', 'EG', 30.12, 31.41, 2],
    ['ADD', 'Addis Ababa', 'ET', 8.98, 38.8, 2], ['NBO', 'Nairobi', 'KE', -1.32, 36.93, 2], ['JNB', 'Johannesburg', 'ZA', -26.14, 28.25, 2],
    ['LOS', 'Lagos', 'NG', 6.58, 3.32, 2], ['CMN', 'Casablanca', 'MA', 33.37, -7.59, 1], ['DEL', 'Delhi', 'IN', 28.56, 77.1, 4],
    ['BOM', 'Mumbai', 'IN', 19.09, 72.87, 3], ['BLR', 'Bengaluru', 'IN', 13.2, 77.71, 2], ['SIN', 'Singapore', 'SG', 1.36, 103.99, 4],
    ['BKK', 'Bangkok', 'TH', 13.69, 100.75, 3], ['KUL', 'Kuala Lumpur', 'MY', 2.75, 101.71, 2], ['CGK', 'Jakarta', 'ID', -6.13, 106.66, 3],
    ['MNL', 'Manila', 'PH', 14.51, 121.02, 2], ['HKG', 'Hong Kong', 'HK', 22.31, 113.91, 4], ['PVG', 'Shanghai', 'CN', 31.14, 121.81, 4],
    ['PEK', 'Beijing', 'CN', 40.08, 116.58, 4], ['CAN', 'Guangzhou', 'CN', 23.39, 113.3, 3], ['ICN', 'Seoul', 'KR', 37.46, 126.44, 4],
    ['HND', 'Tokyo', 'JP', 35.55, 139.78, 5], ['KIX', 'Osaka', 'JP', 34.43, 135.24, 2], ['TPE', 'Taipei', 'TW', 25.08, 121.23, 2],
    ['SYD', 'Sydney', 'AU', -33.95, 151.18, 3], ['MEL', 'Melbourne', 'AU', -37.67, 144.84, 2], ['PER', 'Perth', 'AU', -31.94, 115.97, 1],
    ['AKL', 'Auckland', 'NZ', -37.01, 174.79, 2], ['HNL', 'Honolulu', 'US', 21.32, -157.92, 2], ['ANC', 'Anchorage', 'US', 61.17, -149.99, 1],
    ['ALA', 'Almaty', 'KZ', 43.35, 77.04, 1], ['TAS', 'Tashkent', 'UZ', 41.26, 69.28, 1], ['SVO', 'Moscow', 'RU', 55.97, 37.41, 3],
  ];

  // Fictional operators so no real airline is implied.
  BV.OPERATORS = [['NHR', 'Night Heron Air'], ['KST', 'Kestrel Airways'], ['BSL', 'Basalt Air'], ['MRD', 'Meridian Wings'],
    ['CRV', 'Corvid Cargo'], ['HLC', 'Halcyon Jet'], ['PNC', 'Pinecrest Air'], ['SBL', 'Sable Express'], ['ARC', 'Arcadia Airlines'], ['LTC', 'Lattice Air']];
  BV.AIRCRAFT = [['A320', 450, 37000, 5], ['B738', 455, 36000, 5], ['A21N', 460, 37000, 3], ['E190', 430, 34000, 2],
    ['B789', 490, 41000, 3], ['A359', 488, 41000, 3], ['B77W', 495, 39000, 2], ['A388', 490, 40000, 1], ['B748F', 485, 38000, 1]];

  // Shipping lanes as [lon, lat] waypoints that stay at sea. Ships run them end to end and back.
  BV.LANES = [
    { name: 'Asia–Europe (Suez)', from: 'Shanghai', to: 'Rotterdam', pts: [[122.4, 30.6], [123, 25.5], [119.6, 20.8], [114.5, 13], [109.5, 6], [104.6, 1.3], [100.5, 3.4], [97.4, 5.8], [92, 6.2], [80.6, 5.4], [70, 9], [60, 13], [51, 12.6], [43.5, 12.6], [40.2, 16.2], [37.3, 21.2], [34.6, 26.3], [32.6, 29.8], [32.4, 31.4], [28, 33.4], [20, 35], [12, 37.2], [5, 37.8], [-2, 36.2], [-5.6, 35.95], [-9.5, 37], [-10, 43.5], [-5.5, 48.5], [-1, 50], [2, 51.2], [4, 51.95]] },
    { name: 'Transpacific', from: 'Yokohama', to: 'Los Angeles', pts: [[139.9, 34.9], [150, 38], [165, 42], [180, 44.5], [-165, 45], [-150, 43.5], [-135, 38.5], [-118.3, 33.6]] },
    { name: 'Transpacific South', from: 'Shanghai', to: 'Oakland', pts: [[122.4, 30.6], [130, 30.5], [140, 32], [160, 36], [180, 40], [-160, 41], [-140, 39.5], [-122.6, 37.7]] },
    { name: 'Transatlantic', from: 'New York', to: 'Rotterdam', pts: [[-73.8, 40.4], [-65, 41], [-50, 44], [-35, 47], [-20, 48.6], [-7, 49], [-1, 50], [2, 51.2], [4, 51.95]] },
    { name: 'Panama–Pacific', from: 'Los Angeles', to: 'New York', pts: [[-118.3, 33.6], [-112, 23.5], [-102, 15.5], [-90, 11.5], [-81, 7], [-79.6, 8.8], [-79.9, 9.5], [-77.5, 12.5], [-75, 17], [-74, 20.2], [-73.4, 22], [-74.6, 27], [-75.2, 33], [-73.8, 40.4]] },
    { name: 'Cape of Good Hope', from: 'Singapore', to: 'Santos', pts: [[104.6, 1.3], [100.5, 3.4], [97.4, 5.8], [88, 2], [75, -6], [60, -16], [48, -27], [35, -34.5], [25, -36.6], [18.2, -35], [10, -31], [-5, -27.5], [-25, -25.5], [-40, -25], [-46.3, -24.1]] },
    { name: 'Gulf–India', from: 'Jebel Ali', to: 'Mumbai', pts: [[55, 25.1], [56.4, 26.4], [57.5, 25], [60, 23], [66, 21], [72.7, 18.9]] },
    { name: 'Gulf–Asia', from: 'Ras Tanura', to: 'Singapore', pts: [[50.2, 26.7], [52.5, 26.5], [56.4, 26.4], [58.5, 23.5], [62, 20], [70, 12], [80.6, 5.4], [92, 6.2], [97.4, 5.8], [100.5, 3.4], [104.6, 1.3]] },
    { name: 'Australia–Asia', from: 'Singapore', to: 'Sydney', pts: [[104.6, 1.3], [107.5, -2.5], [112, -5], [115.8, -8.8], [114.5, -15], [112.8, -25], [114.5, -34.5], [125, -36], [135, -36.5], [145, -39.8], [150.5, -37], [151.4, -33.9]] },
    { name: 'Brazil–Europe', from: 'Santos', to: 'Lisbon', pts: [[-46.3, -24.1], [-38, -16], [-33, -6], [-28, 5], [-21, 15], [-17, 25], [-12, 34], [-9.3, 38.6]] },
    { name: 'West Africa', from: 'Lagos', to: 'Rotterdam', pts: [[3.4, 6.3], [-2, 4.2], [-10, 5], [-17.5, 12], [-18.5, 20], [-15, 28], [-10.5, 36], [-9.8, 43.5], [-5.5, 48.5], [-1, 50], [2, 51.2], [4, 51.95]] },
    { name: 'Hong Kong–Busan', from: 'Hong Kong', to: 'Busan', pts: [[114.2, 22.2], [117.5, 23], [120.5, 25.5], [123.5, 29], [126, 32.5], [129, 35]] },
    { name: 'Baltic', from: 'Rotterdam', to: 'St Petersburg', pts: [[4, 51.95], [5, 54], [7.5, 57.2], [10.6, 57.9], [11.3, 56.3], [12.6, 55.3], [14.5, 55.1], [18, 56.5], [21, 58.8], [24.5, 59.7], [29.6, 59.95]] },
  ];
  BV.VESSEL_TYPES = [['container', 5, 18], ['tanker', 3, 13], ['bulk carrier', 3, 12], ['LNG carrier', 1, 17], ['ro-ro', 1, 16], ['research', 0.4, 11]];

  // Seismic source regions [name, lon, lat, spread(deg), weight]
  BV.SEISMIC = [
    ['Honshu, Japan', 142.5, 37.8, 2.2, 6], ['Kuril Islands', 151, 46.5, 2, 3], ['Kamchatka', 160, 53, 2, 2], ['Aleutian Islands', -176, 51.6, 4, 3],
    ['Southern Alaska', -150, 60.5, 2, 2], ['Cascadia', -127, 44.5, 1.5, 1], ['California', -118.5, 35.5, 1.8, 3], ['Oaxaca, Mexico', -98, 16.3, 2, 3],
    ['Central America', -88, 12.5, 2.5, 3], ['Colombia', -77, 4.5, 2, 2], ['Peru', -76, -12, 2.5, 3], ['Northern Chile', -70.5, -22, 2, 3],
    ['Central Chile', -72, -34, 2, 3], ['Lesser Antilles', -61.5, 15.5, 1.5, 1], ['Iceland', -19, 64, 1.2, 1], ['Mid-Atlantic Ridge', -32, 3, 6, 1],
    ['Southern Italy', 15, 39.5, 1.5, 1], ['Aegean Sea', 24.5, 37.8, 1.5, 2], ['Eastern Turkey', 38.5, 38.2, 2, 2], ['Zagros, Iran', 52, 29.5, 3, 3],
    ['Hindu Kush', 70.5, 36.5, 1.2, 2], ['Nepal Himalaya', 85, 28, 2, 2], ['Myanmar', 95.5, 21, 2, 1], ['Sumatra', 97, 1.5, 3, 4],
    ['Java', 110, -8.5, 3, 3], ['Banda Sea', 128, -6.5, 3, 2], ['Philippines', 125.5, 10, 3, 3], ['Taiwan', 121.6, 23.6, 1.2, 2],
    ['Papua New Guinea', 147.5, -6, 3, 3], ['Solomon Islands', 158, -9, 2.5, 2], ['Vanuatu', 168, -16.5, 2, 2], ['Tonga', -175, -20, 2.5, 3],
    ['Kermadec Islands', -178, -30, 2, 2], ['New Zealand', 176, -39.5, 2, 2], ['East African Rift', 36, -3, 3, 1], ['South Sandwich Islands', -26.5, -57.5, 2, 1],
  ];

  // Wildfire-prone regions [name, lon, lat, spread, weight]
  BV.FIRE = [
    ['Amazon basin', -60, -9, 6, 6], ['Cerrado', -48, -14, 4, 4], ['Gran Chaco', -61, -22, 3, 2], ['Northern California', -121.5, 39.5, 1.5, 2],
    ['British Columbia', -122, 52.5, 3, 2], ['Alberta', -115, 56, 3, 1], ['Yakutia, Siberia', 125, 62, 6, 3], ['Amur region', 128, 52, 3, 2],
    ['Northern Australia', 132, -15, 6, 4], ['New South Wales', 149.5, -33.5, 2, 2], ['Sahel', 5, 11, 8, 4], ['Central Africa', 22, -8, 6, 6],
    ['Angola–Zambia', 20, -13, 5, 4], ['Borneo', 113, -1, 3, 2], ['Sumatra', 102, -1.5, 2, 2], ['Mediterranean', 22, 38.5, 4, 2],
    ['Indochina', 102, 18, 3, 3], ['Kazakh steppe', 66, 49, 6, 1],
  ];

  // Tropical cyclone basins [name, lon, lat, mean heading(deg, compass), hemisphere]
  BV.BASINS = [
    ['West Pacific', 138, 13, 300, 1], ['North Atlantic', -48, 14, 285, 1], ['East Pacific', -108, 13, 290, 1],
    ['Bay of Bengal', 88, 13, 330, 1], ['South Indian', 70, -13, 230, -1], ['Coral Sea', 155, -14, 200, -1],
  ];
  BV.STORM_NAMES = ['Ardent', 'Briar', 'Calyx', 'Dorran', 'Elske', 'Fennick', 'Galea', 'Hollis', 'Ivra', 'Juno', 'Kestle', 'Lumen',
    'Marlo', 'Nerys', 'Orin', 'Pell', 'Quill', 'Rhea', 'Soren', 'Talis', 'Ulma', 'Vesper', 'Wren', 'Yara', 'Zeph'];

  // Satellite families: [family, count, inclination, altitude km, prefix]
  BV.SAT_FAMILIES = [
    ['station', 1, 51.6, 420, 'Meridian Station'], ['earth imaging', 9, 97.6, 560, 'KESTREL-'], ['comms constellation', 14, 53, 550, 'LATTICE-'],
    ['weather', 4, 98.7, 830, 'STRATUS-'], ['navigation', 6, 55, 20200, 'NAVBEAM-'], ['geostationary', 8, 0.05, 35786, 'GEOCOM-'],
    ['science', 3, 28.5, 610, 'AURORA-'],
  ];
})();
