import React from 'react';
import { NavLink } from 'react-router-dom';
import './navbar.css';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">Brawl Metrics</div>
            <div className="navbar-links">
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
                <NavLink to="/leaderboards" className={({ isActive }) => isActive ? 'active' : ''}>Leaderboards</NavLink>
                <NavLink to="/mvp" className={({ isActive }) => isActive ? 'active' : ''}>MVP</NavLink>

                <div className="navbar-dropdown">
                    <button className="dropdown-button">Profiles</button>
                    <div className="dropdown-content">
                        <NavLink to={`/profile/${encodeURIComponent('PJYJGGCG')}`} className={({ isActive }) => isActive ? 'active' : ''}>CoffeeCreamer</NavLink>
                        <NavLink to="/profile/%23YCO98JGU" className={({ isActive }) => isActive ? 'active' : ''}>andrewsomeister</NavLink>
                        <NavLink to="/profile/%23UR80QUY" className={({ isActive }) => isActive ? 'active' : ''}>Taminator</NavLink>
                    </div>
                </div>

                <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
            </div>
        </nav>
    );
};

export default Navbar;
