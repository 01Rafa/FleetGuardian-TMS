// [city, state, lat, lng] — 150 major US freight hubs
export const TRUCKING_CITIES = [
  // Florida
  ['Miami', 'FL', 25.7617, -80.1918],
  ['Jacksonville', 'FL', 30.3322, -81.6557],
  ['Orlando', 'FL', 28.5384, -81.3789],
  ['Tampa', 'FL', 27.9506, -82.4572],
  ['Fort Lauderdale', 'FL', 26.1224, -80.1373],
  ['Pensacola', 'FL', 30.4213, -87.2169],
  ['Tallahassee', 'FL', 30.4383, -84.2807],
  ['Lakeland', 'FL', 28.0395, -81.9498],
  ['Fort Myers', 'FL', 26.6406, -81.8723],
  ['Daytona Beach', 'FL', 29.2108, -81.0228],
  ['Gainesville', 'FL', 29.6516, -82.3248],
  ['Sarasota', 'FL', 27.3364, -82.5307],
  // Georgia
  ['Atlanta', 'GA', 33.7490, -84.3880],
  ['Savannah', 'GA', 32.0835, -81.0998],
  ['Augusta', 'GA', 33.4735, -82.0105],
  ['Macon', 'GA', 32.8407, -83.6324],
  ['Columbus', 'GA', 32.4610, -84.9877],
  // Texas
  ['Dallas', 'TX', 32.7767, -96.7970],
  ['Houston', 'TX', 29.7604, -95.3698],
  ['San Antonio', 'TX', 29.4241, -98.4936],
  ['Laredo', 'TX', 27.5064, -99.5075],
  ['El Paso', 'TX', 31.7619, -106.4850],
  ['Austin', 'TX', 30.2672, -97.7431],
  ['Fort Worth', 'TX', 32.7555, -97.3308],
  ['Corpus Christi', 'TX', 27.8006, -97.3964],
  ['Amarillo', 'TX', 35.2220, -101.8313],
  ['Lubbock', 'TX', 33.5779, -101.8552],
  ['Beaumont', 'TX', 30.0860, -94.1018],
  ['Waco', 'TX', 31.5493, -97.1467],
  ['McAllen', 'TX', 26.2034, -98.2300],
  ['Brownsville', 'TX', 25.9017, -97.4975],
  ['Midland', 'TX', 31.9973, -102.0779],
  ['Harlingen', 'TX', 26.1906, -97.6961],
  // Illinois
  ['Chicago', 'IL', 41.8781, -87.6298],
  ['Rockford', 'IL', 42.2711, -89.0940],
  ['Peoria', 'IL', 40.6936, -89.5890],
  ['Springfield', 'IL', 39.7817, -89.6501],
  // Tennessee
  ['Memphis', 'TN', 35.1495, -90.0490],
  ['Nashville', 'TN', 36.1627, -86.7816],
  ['Knoxville', 'TN', 35.9606, -83.9207],
  ['Chattanooga', 'TN', 35.0456, -85.3097],
  // North Carolina
  ['Charlotte', 'NC', 35.2271, -80.8431],
  ['Raleigh', 'NC', 35.7796, -78.6382],
  ['Greensboro', 'NC', 36.0726, -79.7920],
  ['Wilmington', 'NC', 34.2257, -77.9447],
  ['Asheville', 'NC', 35.5951, -82.5515],
  ['Fayetteville', 'NC', 35.0527, -78.8784],
  // California
  ['Los Angeles', 'CA', 34.0522, -118.2437],
  ['Long Beach', 'CA', 33.7701, -118.1937],
  ['San Diego', 'CA', 32.7157, -117.1611],
  ['San Francisco', 'CA', 37.7749, -122.4194],
  ['Oakland', 'CA', 37.8044, -122.2712],
  ['Sacramento', 'CA', 38.5816, -121.4944],
  ['Fresno', 'CA', 36.7378, -119.7871],
  ['Bakersfield', 'CA', 35.3733, -119.0187],
  ['Stockton', 'CA', 37.9577, -121.2908],
  ['Modesto', 'CA', 37.6391, -120.9969],
  ['Riverside', 'CA', 33.9806, -117.3755],
  ['San Bernardino', 'CA', 34.1083, -117.2898],
  ['Redding', 'CA', 40.5865, -122.3917],
  // Arizona
  ['Phoenix', 'AZ', 33.4484, -112.0740],
  ['Tucson', 'AZ', 32.2226, -110.9747],
  ['Flagstaff', 'AZ', 35.1983, -111.6513],
  ['Yuma', 'AZ', 32.6927, -114.6277],
  // Colorado
  ['Denver', 'CO', 39.7392, -104.9903],
  ['Colorado Springs', 'CO', 38.8339, -104.8214],
  ['Pueblo', 'CO', 38.2544, -104.6091],
  // Washington
  ['Seattle', 'WA', 47.6062, -122.3321],
  ['Tacoma', 'WA', 47.2529, -122.4443],
  ['Spokane', 'WA', 47.6587, -117.4260],
  // Oregon
  ['Portland', 'OR', 45.5051, -122.6750],
  ['Eugene', 'OR', 44.0521, -123.0868],
  ['Medford', 'OR', 42.3265, -122.8756],
  // Nevada
  ['Las Vegas', 'NV', 36.1699, -115.1398],
  ['Reno', 'NV', 39.5296, -119.8138],
  // Missouri
  ['Kansas City', 'MO', 39.0997, -94.5786],
  ['St Louis', 'MO', 38.6270, -90.1994],
  ['Springfield', 'MO', 37.2153, -93.2982],
  // New York
  ['New York', 'NY', 40.7128, -74.0060],
  ['Buffalo', 'NY', 42.8865, -78.8784],
  ['Rochester', 'NY', 43.1566, -77.6088],
  ['Syracuse', 'NY', 43.0481, -76.1474],
  ['Albany', 'NY', 42.6526, -73.7562],
  // New Jersey
  ['Newark', 'NJ', 40.7357, -74.1724],
  ['Trenton', 'NJ', 40.2171, -74.7429],
  // Pennsylvania
  ['Philadelphia', 'PA', 39.9526, -75.1652],
  ['Pittsburgh', 'PA', 40.4406, -79.9959],
  ['Allentown', 'PA', 40.6023, -75.4714],
  ['Erie', 'PA', 42.1292, -80.0851],
  // Maryland
  ['Baltimore', 'MD', 39.2904, -76.6122],
  // Ohio
  ['Columbus', 'OH', 39.9612, -82.9988],
  ['Cleveland', 'OH', 41.4993, -81.6944],
  ['Cincinnati', 'OH', 39.1031, -84.5120],
  ['Toledo', 'OH', 41.6528, -83.5379],
  ['Akron', 'OH', 41.0814, -81.5190],
  // Indiana
  ['Indianapolis', 'IN', 39.7684, -86.1581],
  ['Fort Wayne', 'IN', 41.1306, -85.1289],
  ['Evansville', 'IN', 37.9716, -87.5711],
  ['South Bend', 'IN', 41.6764, -86.2520],
  // Minnesota
  ['Minneapolis', 'MN', 44.9778, -93.2650],
  // Michigan
  ['Detroit', 'MI', 42.3314, -83.0458],
  ['Grand Rapids', 'MI', 42.9634, -85.6681],
  ['Flint', 'MI', 43.0125, -83.6875],
  // Kentucky
  ['Louisville', 'KY', 38.2527, -85.7585],
  ['Lexington', 'KY', 38.0406, -84.5037],
  ['Bowling Green', 'KY', 36.9903, -86.4436],
  // Louisiana
  ['New Orleans', 'LA', 29.9511, -90.0715],
  ['Baton Rouge', 'LA', 30.4515, -91.1871],
  ['Shreveport', 'LA', 32.5252, -93.7502],
  ['Monroe', 'LA', 32.5093, -92.1193],
  // Alabama
  ['Birmingham', 'AL', 33.5186, -86.8104],
  ['Montgomery', 'AL', 32.3668, -86.3000],
  ['Huntsville', 'AL', 34.7304, -86.5861],
  ['Mobile', 'AL', 30.6954, -88.0399],
  // Mississippi
  ['Jackson', 'MS', 32.2988, -90.1848],
  ['Meridian', 'MS', 32.3643, -88.7034],
  ['Hattiesburg', 'MS', 31.3271, -89.2903],
  ['Biloxi', 'MS', 30.3960, -88.8853],
  // Oklahoma
  ['Oklahoma City', 'OK', 35.4676, -97.5164],
  ['Tulsa', 'OK', 36.1539, -95.9928],
  // New Mexico
  ['Albuquerque', 'NM', 35.0844, -106.6504],
  ['El Paso', 'TX', 31.7619, -106.4850], // duplicate handled by upsert
  ['Santa Fe', 'NM', 35.6870, -105.9378],
  // Utah
  ['Salt Lake City', 'UT', 40.7608, -111.8910],
  ['Provo', 'UT', 40.2338, -111.6585],
  ['St George', 'UT', 37.1041, -113.5841],
  // Idaho
  ['Boise', 'ID', 43.6150, -116.2023],
  // Wyoming
  ['Cheyenne', 'WY', 41.1400, -104.8202],
  ['Casper', 'WY', 42.8666, -106.3131],
  // Montana
  ['Billings', 'MT', 45.7833, -108.5007],
  ['Great Falls', 'MT', 47.5002, -111.2998],
  ['Missoula', 'MT', 46.8721, -113.9940],
  // Kansas
  ['Wichita', 'KS', 37.6872, -97.3301],
  ['Topeka', 'KS', 39.0473, -95.6752],
  // Nebraska
  ['Omaha', 'NE', 41.2565, -95.9345],
  // Iowa
  ['Des Moines', 'IA', 41.5868, -93.6250],
  ['Davenport', 'IA', 41.5236, -90.5776],
  // Wisconsin
  ['Milwaukee', 'WI', 43.0389, -87.9065],
  ['Madison', 'WI', 43.0731, -89.4012],
  ['Green Bay', 'WI', 44.5133, -88.0133],
  // South Dakota
  ['Sioux Falls', 'SD', 43.5446, -96.7311],
  // North Dakota
  ['Fargo', 'ND', 46.8772, -96.7898],
  // South Carolina
  ['Charleston', 'SC', 32.7765, -79.9311],
  ['Columbia', 'SC', 34.0007, -81.0348],
  ['Greenville', 'SC', 34.8526, -82.3940],
  // Virginia
  ['Richmond', 'VA', 37.5407, -77.4360],
  ['Norfolk', 'VA', 36.8508, -76.2859],
  ['Roanoke', 'VA', 37.2710, -79.9414],
  // Arkansas
  ['Little Rock', 'AR', 34.7465, -92.2896],
  ['Fayetteville', 'AR', 36.0622, -94.1574],
  // Massachusetts
  ['Boston', 'MA', 42.3601, -71.0589],
  ['Worcester', 'MA', 42.2626, -71.8023],
  // Connecticut
  ['Hartford', 'CT', 41.7658, -72.6851],
  ['Bridgeport', 'CT', 41.1865, -73.1952],
  // Delaware
  ['Wilmington', 'DE', 39.7447, -75.5484],
  // Rhode Island
  ['Providence', 'RI', 41.8240, -71.4128],
  // Maine
  ['Portland', 'ME', 43.6591, -70.2568],
  // New Hampshire
  ['Manchester', 'NH', 42.9956, -71.4548],
  // Vermont
  ['Burlington', 'VT', 44.4759, -73.2121],
]
