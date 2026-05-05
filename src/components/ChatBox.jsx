import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import RestaurantCard from './RestaurantCard';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_KEY     = import.meta.env.VITE_GROQ_API_KEY;
const NVIDIA_KEY   = import.meta.env.VITE_NVIDIA_API_KEY;

const genAI      = new GoogleGenerativeAI(GEMINI_KEY || 'dummy_key');
const groqClient = new Groq({ apiKey: GROQ_KEY || 'dummy_key', dangerouslyAllowBrowser: true });

// ─── FOOD SEARCH DETECTION ────────────────────────────────────────────────────
// Any message mentioning food/cuisine → skip AI, go straight to Overpass API
const FOOD_TERMS = [
  'restaurant','food','eat','eating','hungry','hunger','cafe','coffee','pizza',
  'burger','biryani','sushi','chinese','indian','italian','mexican','thai',
  'kebab','noodles','ramen','pasta','sandwich','shawarma','dosa','idli',
  'paratha','chole','pav bhaji','momos','dimsum','waffles','pancakes',
  'breakfast','lunch','dinner','brunch','snack','dessert','cake','ice cream',
  'bakery','bar','pub','diner','fast food','street food','veg','non-veg',
  'vegetarian','vegan','halal','chicken','mutton','fish','seafood','dhaba',
  'hotel','eatery','joint','place to eat','places to eat','spot','spots',
  'near me','nearby','around','local','close by','in my area','in my city',
];

const isFoodQuery = (msg) => {
  const lower = msg.toLowerCase();
  return FOOD_TERMS.some(term => lower.includes(term));
};

// Extract a clean food/cuisine keyword from the user message
const extractKeyword = (msg) => {
  return msg
    .toLowerCase()
    .replace(/\b(find|show|get|search|look for|i want|i need|suggest|recommend|give me|tell me about|what about|any good|can you find|can you show|are there|is there)\b/g, '')
    .replace(/\b(near me|nearby|around here|around me|in my area|in my city|close by|local)\b/g, '')
    .replace(/\b(please|pls|me|some|a|the|good|great|nice|best|top|amazing|delicious|yummy|tasty)\b/g, '')
    .replace(/[?!.,]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
};

// ─── HAVERSINE DISTANCE ───────────────────────────────────────────────────────
const getFormattedDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1 ? `${(d * 1000).toFixed(0)}m away` : `${d.toFixed(1)}km away`;
};

// ─── SEEDED RATING (consistent per restaurant name) ──────────────────────────
const getSeededRating = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return (3.8 + (Math.abs(hash) % 1000) / 1000 * 1.1).toFixed(1);
};

// ─── KEYWORD-AWARE MATCH SCORE ────────────────────────────────────────────────
const computeMatchScore = (tags = {}, keyword = '') => {
  if (!keyword) return 82;
  const terms = keyword.toLowerCase().split(' ').filter(w => w.length > 2);
  const name    = (tags.name    || '').toLowerCase();
  const cuisine = (tags.cuisine || '').toLowerCase();
  const desc    = (tags.description || '').toLowerCase();
  let score = 72;
  terms.forEach(t => {
    if (name.includes(t))    score += 9;
    if (cuisine.includes(t)) score += 11;
    if (desc.includes(t))    score += 3;
  });
  return Math.min(score, 99);
};

// ─── CUISINE → IMAGE MAP (12 types) ──────────────────────────────────────────
const getCuisineImage = (cuisine = '') => {
  const c = cuisine.toLowerCase();
  if (c.includes('biryani'))                          return 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?auto=format&fit=crop&w=400&q=80';
  if (c.includes('indian') || c.includes('curry'))   return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80';
  if (c.includes('burger') || c.includes('american'))return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
  if (c.includes('pizza')  || c.includes('italian')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80';
  if (c.includes('cafe')   || c.includes('coffee'))  return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80';
  if (c.includes('chinese')|| c.includes('asian'))   return 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80';
  if (c.includes('sushi')  || c.includes('japanese'))return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=400&q=80';
  if (c.includes('mexican')|| c.includes('taco'))    return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=400&q=80';
  if (c.includes('thai'))                            return 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=400&q=80';
  if (c.includes('kebab')  || c.includes('arabic'))  return 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=400&q=80';
  if (c.includes('sandwich')|| c.includes('deli'))   return 'https://images.unsplash.com/photo-1509722747041-616f39b57380?auto=format&fit=crop&w=400&q=80';
  if (c.includes('dessert') || c.includes('bakery')) return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80';
  return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80';
};

// ─── BUILD CONVERSATION HISTORY (last 8 turns) ───────────────────────────────
const buildHistory = (messages) =>
  messages.slice(-8).map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text || ''
  }));

// ─── GET USER LOCATION (GPS → IP fallback) ───────────────────────────────────
const getUserLocation = async () => {
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    );
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (!data.latitude) throw new Error('Location unavailable');
    return { lat: data.latitude, lon: data.longitude };
  }
};

// ─── FETCH REAL NEARBY RESTAURANTS (Overpass API with Failover) ──────────────
const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const fetchWithRetry = async (query, retries = 2) => {
  let lastError;
  for (let i = 0; i < OVERPASS_INSTANCES.length; i++) {
    for (let r = 0; r <= retries; r++) {
      try {
        const res = await fetch(OVERPASS_INSTANCES[i], {
          method : 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body   : `data=${encodeURIComponent(query)}`
        });
        if (res.ok) return await res.json();
        if (res.status === 429) break; // Too many requests on this instance, move to next
      } catch (e) {
        lastError = e;
      }
      // Wait a bit before retry on same instance
      if (r < retries) await new Promise(res => setTimeout(res, 1000));
    }
  }
  throw lastError || new Error('Overpass servers are currently busy');
};

const fetchNearbyRestaurants = async (keyword, lat, lon) => {
  const radius = 8000;
  const terms  = keyword
    .split(' ')
    .filter(w => w.length > 2 && !['restaurant','food','eat','eating'].includes(w));

  if (isSpecific) {
    const fullRegex = terms.join('.*');
    queryBody = `
      nwr["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bakery|bar|pub|deli|diner"]["name"~"${fullRegex}",i](around:${radius},${lat},${lon});
      nwr["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bakery|bar|pub|deli|diner"]["cuisine"~"${fullRegex}",i](around:${radius},${lat},${lon});
      nwr["shop"~"bakery|confectionery|pastry|deli|food"]["name"~"${fullRegex}",i](around:${radius},${lat},${lon});
      nwr["name"~"${fullRegex}",i](around:${radius},${lat},${lon});
    `;
  } else {
    queryBody = `
      nwr["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bakery|bar|pub|deli"](around:${radius},${lat},${lon});
      nwr["shop"~"bakery|confectionery|pastry|deli"](around:${radius},${lat},${lon});
    `;
  }

  const query = `[out:json][timeout:15];(${queryBody});out center 50;`;
  
  try {
    let data = await fetchWithRetry(query);
    let results = data.elements || [];

    // Fallback: fetch all nearby + filter locally if no specific results found
    if (results.length === 0 && isSpecific) {
      const fb = `[out:json][timeout:15];(nwr["amenity"~"restaurant|cafe|fast_food|bakery|ice_cream|bar|pub|diner"](around:${radius},${lat},${lon});nwr["shop"~"bakery|deli|food"](around:${radius},${lat},${lon}););out center 150;`;
      const fbData = await fetchWithRetry(fb);
      const fbElements = fbData.elements || [];
      results = fbElements.filter(el => {
        const n = (el.tags?.name || '').toLowerCase();
        const c = (el.tags?.cuisine || '').toLowerCase();
        return terms.some(t => n.includes(t) || c.includes(t));
      });
      if (results.length === 0) {
        // If still no matches for terms, don't just show generic ones
        // Only show generic ones if the user didn't specify a name
        return []; 
      }
    }

    return results
      .filter(el => el.tags?.name)
      .slice(0, 5)
      .map(el => {
        const tags       = el.tags || {};
        const rawCuisine = tags.cuisine || tags.amenity || tags.shop || 'Restaurant';
        const display    = rawCuisine.replace(/_/g, ' ').split(';')[0].trim();
        const elLat      = el.lat || el.center?.lat || lat;
        const elLon      = el.lon || el.center?.lon || lon;
        const score      = computeMatchScore(tags, keyword);
        return {
          id          : el.id,
          title       : tags.name,
          rating      : getSeededRating(tags.name),
          match_score : score,
          tags        : [display, getFormattedDistance(lat, lon, elLat, elLon)],
          description : tags.description || `A popular local spot known for ${display}.`,
          concierge_tip: score >= 90
            ? 'Top local pick — highly rated by people in this area.'
            : 'A solid neighbourhood favourite worth visiting.',
          image       : getCuisineImage(rawCuisine),
          lat         : elLat,
          lon         : elLon
        };
      })
      .sort((a, b) => b.match_score - a.match_score);
  } catch (err) {
    throw new Error('Culinary database is temporarily busy. Please try again in a few seconds!');
  }
};

// ─── CALL AI (Groq first → NVIDIA → Gemini) ──────────────────────────────────
const callAI = async (systemPrompt, history, userMsg) => {
  // 1. Groq (primary — fastest)
  if (GROQ_KEY && GROQ_KEY !== 'dummy_key' && GROQ_KEY !== 'YOUR_GROQ_API_KEY_HERE') {
    try {
      const res = await groqClient.chat.completions.create({
        model      : 'llama-3.3-70b-versatile',
        temperature: 0.7,
        messages   : [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userMsg }]
      });
      return res.choices[0].message.content;
    } catch (e) { console.warn('Groq failed:', e.message); }
  }

  // 2. NVIDIA (backup)
  if (NVIDIA_KEY && NVIDIA_KEY !== 'dummy_key') {
    try {
      const res = await fetch('/nvidia-api/chat/completions', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_KEY.trim()}` },
        body   : JSON.stringify({
          model      : 'meta/llama-3.1-70b-instruct',
          temperature: 0.7,
          messages   : [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userMsg }]
        })
      });
      if (!res.ok) throw new Error(`NVIDIA ${res.status}`);
      return (await res.json()).choices[0].message.content;
    } catch (e) { console.warn('NVIDIA failed:', e.message); }
  }

  // 3. Gemini (last resort)
  if (GEMINI_KEY && GEMINI_KEY !== 'dummy_key') {
    const histText = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
    const prompt   = `${systemPrompt}\n\n${histText ? 'Conversation so far:\n' + histText + '\n\n' : ''}User: ${userMsg}`;
    const model    = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result   = await model.generateContent(prompt);
    return result.response.text();
  }

  throw new Error('No AI provider available. Please add a Groq or NVIDIA API key.');
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ChatBox = ({ userName, activeChatId, initialMessages, onUpdateSession }) => {
  const [messages,  setMessages]  = useState(initialMessages);
  const [inputVal,  setInputVal]  = useState('');
  const [isTyping,  setIsTyping]  = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [activeChatId]);

  // ── Push a bot message and persist ─────────────────────────────────────────
  const pushBot = (currentMsgs, text, cards = [], chatTitle = null) => {
    const updated = [...currentMsgs, { id: Date.now() + 1, sender: 'bot', text, cards }];
    setMessages(updated);
    onUpdateSession(activeChatId, updated, chatTitle);
    return updated;
  };

  // ── Handle send ─────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isTyping) return;

    const userMsg    = inputVal.trim();
    setInputVal('');
    setIsTyping(true);

    // Append user message immediately
    const withUser = [...messages, { id: Date.now(), sender: 'user', text: userMsg }];
    setMessages(withUser);
    
    // If it's the first message, set a temporary title based on the message
    const initialTitle = messages.length === 0 ? (userMsg.slice(0, 20) + (userMsg.length > 20 ? '...' : '')) : null;
    onUpdateSession(activeChatId, withUser, initialTitle);

    try {
      // ── PATH A: Food/restaurant query → skip AI, go straight to Overpass ──
      if (isFoodQuery(userMsg)) {
        const keyword = extractKeyword(userMsg) || 'restaurant';

        // Show instant "searching..." message
        const searching = [...withUser, {
          id: Date.now() + 1, sender: 'bot',
          text: `🔍 Searching for "${keyword}" near you...`, cards: []
        }];
        setMessages(searching);

        // Get location + fetch restaurants in parallel where possible
        const { lat, lon } = await getUserLocation();
        const restaurants  = await fetchNearbyRestaurants(keyword, lat, lon);

        // Replace the searching message with results
        const chatTitle = keyword.charAt(0).toUpperCase() + keyword.slice(1, 20);
        const resultMsg = restaurants.length > 0
          ? `Here are the best "${keyword}" spots near you, ranked by relevance! 📍`
          : `I couldn't find "${keyword}" spots nearby. Try a broader search!`;

        const final = [...withUser, { id: Date.now() + 2, sender: 'bot', text: resultMsg, cards: restaurants }];
        setMessages(final);
        onUpdateSession(activeChatId, final, chatTitle);

      } else {
        // ── PATH B: Conversational query → use AI (Groq → NVIDIA → Gemini) ─
        const systemPrompt = `You are Onebite, a world-class Digital Culinary Concierge. You are sophisticated, warm, and knowledgeable about food, restaurants, and dining experiences.

For conversational questions (moods, vibes, cuisine suggestions, dining advice), give a helpful, engaging response.
For any food or restaurant search requests, ALWAYS respond ONLY with this JSON:
{ "map_search": "<food keyword>" }

Never make up restaurant names. Always use map_search for any food/location request.`;

        const output = await callAI(systemPrompt, buildHistory(messages), userMsg);

        // Check if AI returned a map_search JSON
        try {
          const clean  = output.replace(/^```json/, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed.map_search) {
            // AI decided it needs a map search
            const keyword = parsed.map_search;
            const { lat, lon }  = await getUserLocation();
            const restaurants   = await fetchNearbyRestaurants(keyword, lat, lon);
            const chatTitle     = keyword.charAt(0).toUpperCase() + keyword.slice(1, 20);
            const resultMsg     = restaurants.length > 0
              ? `Here are the best "${keyword}" spots near you! 📍`
              : `Couldn't find "${keyword}" spots nearby.`;
            pushBot(withUser, resultMsg, restaurants, chatTitle);
            return;
          }
        } catch { /* not JSON, treat as plain text */ }

        // Plain conversational response
        const chatTitle = userMsg.slice(0, 20);
        pushBot(withUser, output, [], chatTitle);
      }

    } catch (err) {
      console.error('Onebite error:', err);
      const isLocation = err.message.includes('location') || err.message.includes('Location');
      const msg = isLocation
          ? '📍 I need your location to find nearby restaurants. Please allow location access in your browser and try again.'
          : err.message || 'Something went wrong. Please try again.';
      
      pushBot(withUser, <div className="error-content"><span className="error-pulse-icon">⚠️</span> {msg}</div>, []);
    } finally {
      setIsTyping(false);
    }
  };

  const timeGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  };

  return (
    <>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat-greeting">
            <h1>Good {timeGreeting()}, {userName}!</h1>
            <p>What are you craving today?</p>
            <div className="suggestion-chips">
              {[
                '🍕 Best pizza nearby',
                '☕ Cozy café vibes',
                '🍜 Ramen spots',
                '🎉 Romantic dinner',
                '🥘 Biryani near me',
                '🍔 Burger joints',
              ].map(s => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => setInputVal(s.slice(2).trim())}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`message-wrapper ${m.sender}`}>
              <div className="message-bubble"><p>{m.text}</p></div>
              {m.cards?.length > 0 && (
                <div className="cards-container">
                  {m.cards.map((c) => <RestaurantCard key={c.id} {...c} />)}
                </div>
              )}
            </div>
          ))
        )}
        {isTyping && (
          <div className="message-wrapper bot">
            <div className="typing-indicator"><span /><span /><span /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <form onSubmit={handleSend} className="input-box">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask Onebite to find the perfect spot..."
            disabled={isTyping}
          />
          <button type="submit" disabled={isTyping || !inputVal.trim()} className="send-btn">
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatBox;
