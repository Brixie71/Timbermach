import React from 'react'

const Header = ({ darkMode = false }) => {
    return (
        <div className="flex items-center">
            <h1 className={`p-3 text-xl font-bold m-0 ${
                darkMode ? 'text-gray-100' : 'text-gray-800'
            }`}>
                Timber Test Management System
            </h1>
        </div>
    )
}

export default Header