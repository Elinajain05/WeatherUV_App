import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const OPENWEATHER_API_KEY = process.env.API_KEY;

app.get("/", (req, res) => {
  res.render("forecast", { location: null, forecast: null, uvIndex: null, error: null });
});

app.post("/get-forecast", async (req, res) => {
  const cityState = req.body.cityState.trim();

  try {
    // 1. Get Coordinates
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityState)}&limit=1&appid=${OPENWEATHER_API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error("Location not found");
    }

    const { lat, lon, name, state, country } = geoResponse.data[0];
    const location = `${name}${state ? ", " + state : ""}, ${country}`;

    // 2. Get Forecast (5 day / 3 hour interval)
    const forecastRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );

    // 3. Get Current Weather (for temp & UV substitute)
    const currentRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );

    // Extract 7 day forecast by grouping by date
    const dailyMap = {};

    forecastRes.data.list.forEach((entry) => {
      const date = new Date(entry.dt * 1000).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });

      if (!dailyMap[date]) {
        dailyMap[date] = {
          temps: [],
          descriptions: [],
          wind: [],
          humidity: [],
          icon: entry.weather[0].main.toLowerCase(),
        };
      }

      dailyMap[date].temps.push(entry.main.temp);
      dailyMap[date].descriptions.push(entry.weather[0].description);
      dailyMap[date].wind.push(entry.wind.speed);
      dailyMap[date].humidity.push(entry.main.humidity);
    });

    const forecast = Object.entries(dailyMap).slice(0, 5).map(([date, data]) => {
      return {
        readableDate: date,
        temp: {
          min: Math.min(...data.temps).toFixed(1),
          max: Math.max(...data.temps).toFixed(1),
          day: (data.temps.reduce((a, b) => a + b, 0) / data.temps.length).toFixed(1),
        },
        weather: [{ description: data.descriptions[0], main: data.icon }],
        wind_speed: (data.wind.reduce((a, b) => a + b, 0) / data.wind.length).toFixed(1),
        humidity: (data.humidity.reduce((a, b) => a + b, 0) / data.humidity.length).toFixed(1),
      };
    });

    const uvIndex = currentRes.data.weather[0].main; // using UV substitute
    res.render("forecast", { location, forecast, uvIndex, error: null });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.render("forecast", { location: null, forecast: null, uvIndex: null, error: "Could not retrieve forecast." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
