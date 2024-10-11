import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div>
      <div className="absolute top-4 left-4">
        <Link to="/" className="text-blue-500 hover:text-blue-600">
          CrystalBall
        </Link>
      </div>
      <div className="absolute top-4 right-4 flex space-x-4">
        <Link to="/previous" className="text-blue-500 hover:text-blue-600">
          All Searches
        </Link>
        <a
          href="https://docs.google.com/presentation/d/14lYkmKgAgr1XXPZt4jf-yXKOR-udq9f3lYA7R4Fn7ec/edit#slide=id.g2f9b2d73cec_0_12"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600"
        >
          How it works
        </a>
      </div>
    </div>
  );
};

export default Header;
