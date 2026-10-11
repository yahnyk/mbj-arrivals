import fs from 'fs';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) {
  console.error("RAPIDAPI_KEY is not set");
  process.exit(1);
}

async function fetchFlights() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  
  const start = new Date(now.getTime() - 2 * 60 * 60 * 1000); 
  const end = new Date(now.getTime() + 10 * 60 * 60 * 1000);  

  const url = `https://aerodatabox.p.rapidapi.com/flights/airports/iata/MBJ/${formatDate(start)}/${formatDate(end)}?withLeg=true&direction=arrival&withCancelled=true&withCodeshared=true`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`AeroDataBox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const arrivals = data.arrivals || [];

    const formattedFlights = arrivals.map(f => {
      const flightNum = f.number || f.callSign || 'Unknown';
      const origin = f.departure?.airport?.name || f.departure?.airport?.shortName || 'Unknown Origin';
      const arrTime = f.arrival?.scheduledTime?.local || f.arrival?.predictedTime?.local || '';
      const timeStr = arrTime ? arrTime.split('T')[1]?.substring(0, 5) || '--:--' : '--:--';
      
      let status = f.status || 'On Time';
      if (status === 'Estimated') status = 'On Time';
      if (status === 'Delayed') status = 'Delayed';
      if (status === 'Landed') status = 'Landed';
      if (status === 'Cancelled') status = 'Cancelled';

      return {
        flight: flightNum,
        from: origin.replace(' Airport', ''),
        time: timeStr,
        status: status
      };
    });

    formattedFlights.sort((a, b) => a.time.localeCompare(b.time));

    const output = {
      source: "aerodatabox",
      ts: new Date().toISOString(),
      flights: formattedFlights.slice(0, 15)
    };

    fs.writeFileSync('flights.json', JSON.stringify(output, null, 2));
    console.log(`Successfully updated flights.json with ${formattedFlights.length} arrivals.`);

  } catch (error) {
    console.error("Failed to fetch flights:", error.message);
    process.exit(1);
  }
}

fetchFlights();
