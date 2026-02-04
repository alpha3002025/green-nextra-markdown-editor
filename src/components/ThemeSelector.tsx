import React, { useEffect, useState } from 'react';

const themes = [
    { name: 'Green', value: 'theme-green', color: '#42b883' },
    { name: 'Blue', value: 'theme-blue', color: '#3b82f6' },
    { name: 'Sky', value: 'theme-sky', color: '#0ea5e9' },
    { name: 'Purple', value: 'theme-purple', color: '#8b5cf6' },
    { name: 'Orange', value: 'theme-orange', color: '#f97316' },
    { name: 'Yellow', value: 'theme-yellow', color: '#eab308' },
    { name: 'Black', value: 'theme-black', color: '#18181b' },
    { name: 'Red', value: 'theme-red', color: '#ef4444' },
];

export function ThemeSelector() {
    const [currentTheme, setCurrentTheme] = useState('theme-green');

    useEffect(() => {
        // Initial Load
        const stored = localStorage.getItem('app-theme');
        if (stored) {
            setCurrentTheme(stored);
            document.documentElement.classList.add(stored);
        } else {
            // Default
            document.documentElement.classList.add('theme-green');
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value;
        const oldTheme = currentTheme;
        setCurrentTheme(newTheme);
        localStorage.setItem('app-theme', newTheme);

        document.documentElement.classList.remove(oldTheme);
        document.documentElement.classList.add(newTheme);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '1rem' }}>
            <span
                style={{
                    backgroundColor: themes.find(t => t.value === currentTheme)?.color,
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    marginRight: '6px',
                    display: 'inline-block',
                    flexShrink: 0
                }}
            />
            <select
                value={currentTheme}
                onChange={handleChange}
                style={{
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'currentColor',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 500
                }}
            >
                {themes.map(t => (
                    <option key={t.value} value={t.value}>{t.name}</option>
                ))}
            </select>
        </div>
    );
}
