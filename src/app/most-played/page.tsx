"use client";

import { useEffect } from "react";

export default function MostPlayedPage() {
    useEffect(() => {
        const fetchMostPlayed = async () => {
            const timeRanges = ["short_term", "medium_term", "long_term"];
            
            for (const range of timeRanges) {
                try {
                    const res = await fetch(`/api/spotify/most-played?time_range=${range}`);
                    if (!res.ok) throw new Error("Failed to fetch");
                    const data = await res.json();
                    
                    console.log(`\n=== Most Played Songs (${range}) ===`);
                    data.tracks.forEach((track: any, index: number) => {
                        const minutes = Math.floor(track.durationMs / 60000);
                        const seconds = ((track.durationMs % 60000) / 1000).toFixed(0);
                        const formattedLength = `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;

                        console.log(`${index + 1}. ${track.songName}`);
                        console.log(`   Artist: ${track.artistName}`);
                        console.log(`   Album: ${track.albumName}`);
                        console.log(`   Album Cover: ${track.albumCoverUrl}`);
                        console.log(`   Length: ${formattedLength}`);
                    });
                } catch (error) {
                    console.error(`Error fetching data for ${range}:`, error);
                }
            }
        };

        fetchMostPlayed();
    }, []);

    return (
        <div style={{ padding: "2rem", color: "white", fontFamily: "sans-serif" }}>
            <h1>Most Played Songs</h1>
            <p>Please open the browser console (F12) to view the requested data.</p>
        </div>
    );
}
