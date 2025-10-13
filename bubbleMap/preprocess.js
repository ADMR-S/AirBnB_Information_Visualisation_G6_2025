import * as d3 from "d3";
import { exec } from "child_process";

// Define the projection
const projection = d3.geoAlbersUsa().scale(1280).translate([480, 300]);

// Input and output files
const inputShapefile = "build/cb_2020_us_county_20m.shp";
const outputJson = "build/counties.json";

// Run the topojson command
const topojsonCommand = `node_modules/.bin/topojson -o ${outputJson} --simplify=.5 -- counties=${inputShapefile}`;
exec(topojsonCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`TopoJSON created: ${stdout}`);
});