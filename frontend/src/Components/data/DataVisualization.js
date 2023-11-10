import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, BarChart, Bar } from 'recharts';
import './DataVisualization.css'; // Import the CSS styling

const DataVisualization = ({ playerProgressData, brawlerData, teamPerformanceData }) => {
    return (
        <div className="data-vis-container">
            {/* Player Progress Over Time */}
            <div className="chart-container">
                <h2>Player Progress Over Time</h2>
                <LineChart width={600} height={300} data={playerProgressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="trophies" stroke="#8884d8" />
                </LineChart>
            </div>

            {/* Brawler-Specific Performance */}
            <div className="chart-container">
                <h2>Brawler Performance</h2>
                <PieChart width={400} height={400}>
                    <Pie dataKey="winRate" isAnimationActive={false} data={brawlerData} cx={200} cy={200} outerRadius={80} fill="#8884d8" label />
                    <Tooltip />
                </PieChart>
            </div>

            {/* Team Performance Visualization */}
            <div className="chart-container">
                <h2>Team Performance</h2>
                <BarChart width={600} height={300} data={teamPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="winRate" fill="#82ca9d" />
                    {/* Add more bars for other metrics as needed */}
                </BarChart>
            </div>
        </div>
    );
}

export default DataVisualization;
