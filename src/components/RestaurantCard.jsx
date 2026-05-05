import React from 'react';

const RestaurantCard = ({ 
  title, 
  rating, 
  tags, 
  description, 
  match_score, 
  concierge_tip, 
  image,
  lat,
  lon
}) => {
  const displayTags = tags || [];

  const mapsUrl = lat && lon 
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`;

  return (
    <div className="restaurant-card">
      <div className="card-image-wrap">
        <img src={image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80'} alt={title} />
        {match_score && (
          <div className="match-score-badge">
            {match_score}% Match
          </div>
        )}
      </div>
      
      <div className="card-content">
        <div className="card-header">
          <h4>{title}</h4>
          <span className="rating">⭐ {rating || '4.5'}</span>
        </div>
        
        <div className="card-tags">
          {displayTags.map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
        
        <p className="card-description">{description}</p>
        
        {concierge_tip && (
          <div className="concierge-tip">
            <span className="tip-icon">✨</span>
            <span className="tip-text">{concierge_tip}</span>
          </div>
        )}

        <a href={mapsUrl} target="_blank" rel="noreferrer" className="view-map-btn">
          📍 View on Maps
        </a>
      </div>
    </div>
  );
};

export default RestaurantCard;
