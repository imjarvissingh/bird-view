/* birds view · reference cities used to place mock records plausibly on land.
   [city, country code, lat, lon, weight] */
(function () {
  const BV = (window.BV = window.BV || {});
  BV.PLACES = [
    ['Reykjavik', 'IS', 64.15, -21.94], ['Oslo', 'NO', 59.91, 10.75], ['Stockholm', 'SE', 59.33, 18.07],
    ['Helsinki', 'FI', 60.17, 24.94], ['Dublin', 'IE', 53.35, -6.26], ['London', 'GB', 51.51, -0.13],
    ['Amsterdam', 'NL', 52.37, 4.9], ['Frankfurt', 'DE', 50.11, 8.68], ['Berlin', 'DE', 52.52, 13.4],
    ['Paris', 'FR', 48.86, 2.35], ['Madrid', 'ES', 40.42, -3.7], ['Lisbon', 'PT', 38.72, -9.14],
    ['Zurich', 'CH', 47.38, 8.54], ['Milan', 'IT', 45.46, 9.19], ['Warsaw', 'PL', 52.23, 21.01],
    ['Prague', 'CZ', 50.08, 14.44], ['Vienna', 'AT', 48.21, 16.37], ['Bucharest', 'RO', 44.43, 26.1],
    ['Kyiv', 'UA', 50.45, 30.52], ['Istanbul', 'TR', 41.01, 28.98], ['Tallinn', 'EE', 59.44, 24.75],
    ['Cairo', 'EG', 30.04, 31.24], ['Lagos', 'NG', 6.52, 3.38], ['Nairobi', 'KE', -1.29, 36.82],
    ['Johannesburg', 'ZA', -26.2, 28.05], ['Casablanca', 'MA', 33.57, -7.59], ['Accra', 'GH', 5.6, -0.19],
    ['Dubai', 'AE', 25.2, 55.27], ['Riyadh', 'SA', 24.71, 46.68], ['Tel Aviv', 'IL', 32.09, 34.78],
    ['Mumbai', 'IN', 19.08, 72.88], ['Bengaluru', 'IN', 12.97, 77.59], ['Delhi', 'IN', 28.61, 77.21],
    ['Karachi', 'PK', 24.86, 67.0], ['Dhaka', 'BD', 23.81, 90.41], ['Singapore', 'SG', 1.35, 103.82],
    ['Jakarta', 'ID', -6.21, 106.85], ['Bangkok', 'TH', 13.76, 100.5], ['Hanoi', 'VN', 21.03, 105.85],
    ['Manila', 'PH', 14.6, 120.98], ['Hong Kong', 'HK', 22.32, 114.17], ['Taipei', 'TW', 25.03, 121.57],
    ['Shanghai', 'CN', 31.23, 121.47], ['Beijing', 'CN', 39.9, 116.4], ['Shenzhen', 'CN', 22.54, 114.06],
    ['Seoul', 'KR', 37.57, 126.98], ['Tokyo', 'JP', 35.68, 139.69], ['Osaka', 'JP', 34.69, 135.5],
    ['Sydney', 'AU', -33.87, 151.21], ['Melbourne', 'AU', -37.81, 144.96], ['Auckland', 'NZ', -36.85, 174.76],
    ['Almaty', 'KZ', 43.24, 76.89], ['Tashkent', 'UZ', 41.3, 69.24], ['Novosibirsk', 'RU', 55.01, 82.93],
    ['Vancouver', 'CA', 49.28, -123.12], ['Toronto', 'CA', 43.65, -79.38], ['Montreal', 'CA', 45.5, -73.57],
    ['Seattle', 'US', 47.61, -122.33], ['San Francisco', 'US', 37.77, -122.42], ['Los Angeles', 'US', 34.05, -118.24],
    ['Denver', 'US', 39.74, -104.99], ['Dallas', 'US', 32.78, -96.8], ['Chicago', 'US', 41.88, -87.63],
    ['Atlanta', 'US', 33.75, -84.39], ['Ashburn', 'US', 39.04, -77.49], ['New York', 'US', 40.71, -74.01],
    ['Miami', 'US', 25.76, -80.19], ['Mexico City', 'MX', 19.43, -99.13], ['Bogota', 'CO', 4.71, -74.07],
    ['Lima', 'PE', -12.05, -77.04], ['Santiago', 'CL', -33.45, -70.67], ['Buenos Aires', 'AR', -34.6, -58.38],
    ['Sao Paulo', 'BR', -23.55, -46.63], ['Rio de Janeiro', 'BR', -22.91, -43.17], ['Panama City', 'PA', 8.98, -79.52],
  ];
})();
