Get Playlist Items

OAuth 2.0
Get full details of the items of a playlist owned by a Spotify user.

Note: This endpoint is only accessible for playlists owned by the current user or playlists the user is a collaborator of. A 403 Forbidden status code will be returned if the user is neither the owner nor a collaborator of the playlist.

Important policy notes
Spotify content may not be downloaded
Keep visual content in its original form
Ensure content attribution
Spotify content may not be used to train machine learning or AI model
Authorization scopes
playlist-read-private
Request
GET/playlists/{playlist_id}/items
playlist_idstring
Required
The Spotify ID of the playlist.

Example: 3cEYpjA9oz9GiPac4AsH4n
marketstring
An ISO 3166-1 alpha-2 country code. If a country code is specified, only content that is available in that market will be returned.
If a valid user access token is specified in the request header, the country associated with the user account will take priority over this parameter.
Note: If neither market or user country are provided, the content is considered unavailable for the client.
Users can view the country that is associated with their account in the account settings.

Example: market=ES
fieldsstring
Filters for the query: a comma-separated list of the fields to return. If omitted, all fields are returned. For example, to get just the total number of items and the request limit:
fields=total,limit
A dot separator can be used to specify non-reoccurring fields, while parentheses can be used to specify reoccurring fields within objects. For example, to get just the added date and user ID of the adder:
fields=items(added_at,added_by.id)
Use multiple parentheses to drill down into nested objects, for example:
fields=items(track(name,href,album(name,href)))
Fields can be excluded by prefixing them with an exclamation mark, for example:
fields=items.track.album(!external_urls,images)

Example: fields=items(added_by.id,track(name,href,album(name,href)))
limitinteger
The maximum number of items to return. Default: 20. Minimum: 1. Maximum: 50.

Default: limit=20
Range: 0 - 50
Example: limit=10
offsetinteger
The index of the first item to return. Default: 0 (the first item). Use with limit to get the next set of items.

Default: offset=0
Example: offset=5
additional_typesstring
A comma-separated list of item types that your client supports besides the default track type. Valid types are: track and episode.
Note: This parameter was introduced to allow existing clients to maintain their current behaviour and might be deprecated in the future.
In addition to providing this parameter, make sure that your client properly handles cases of new types in the future by checking against the type field of each object.

Response
200
401
403
429
Pages of tracks

hrefstring
Required
A link to the Web API endpoint returning the full result of the request

Example: "https://api.spotify.com/v1/me/shows?offset=0&limit=20"
limitinteger
Required
The maximum number of items in the response (as set in the query or by default).

Example: 20
nextstring
Required
Nullable
URL to the next page of items. ( null if none)

Example: "https://api.spotify.com/v1/me/shows?offset=1&limit=1"
offsetinteger
Required
The offset of the items returned (as set in the query or by default)

Example: 0
previousstring
Required
Nullable
URL to the previous page of items. ( null if none)

Example: "https://api.spotify.com/v1/me/shows?offset=1&limit=1"
totalinteger
Required
The total number of items available to return.

Example: 4

itemsarray of PlaylistTrackObject
Required
added_atstring [date-time]
The date and time the track or episode was added. Note: some very old playlists may return null in this field.


added_byobject
The Spotify user who added the track or episode. Note: some very old playlists may return null in this field.

is_localboolean
Whether this track or episode is a local file or not.

itemoneOf
Information about the track or episode.

Will be one of the following:

TrackObjectobject

EpisodeObjectobject
trackoneOf
Deprecated
Deprecated: Use item instead. Information about the track or episode.

Will be one of the following:

TrackObjectobject

EpisodeObject

Web API Changelog - February 2026
Overview
These changes are related to this blog post. The changes are categorised by endpoints (removed, changed, or added), and then by fields on the different content types (track, playlist, chapter, etc.) Lastly you find a list with all endpoints still available, but field and behavioral changes mentioned earlier still apply.

For step-by-step instructions on how to update your application, see the February 2026 Migration Guide.

Changes to endpoints
The following changes have been made to the endpoints.

[REMOVED] Create Playlist for user (POST /users/{user_id}/playlists) - Create a playlist for a Spotify user.
Use POST /me/playlists instead
[REMOVED] Get Artist's Top Tracks (GET /artists/{id}/top-tracks) – Get Spotify catalog information about an artist's top tracks by country.
[REMOVED] Get Available Markets (GET /markets) – Get the list of markets where Spotify is available.
[REMOVED] Get New Releases (GET /browse/new-releases) – Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player's "Browse" tab).
[REMOVED] Get Several Albums (GET /albums) – Get Spotify catalog information for multiple albums identified by their Spotify IDs.
[REMOVED] Get Several Artists (GET /artists) – Get Spotify catalog information for several artists based on their Spotify IDs.
[REMOVED] Get Several Audiobooks (GET /audiobooks) – Get Spotify catalog information for several audiobooks identified by their Spotify IDs.
[REMOVED] Get Several Browse Categories (GET /browse/categories) – Get a list of categories used to tag items in Spotify (on, for example, the Spotify player's "Browse" tab).
[REMOVED] Get Several Chapters (GET /chapters) – Get Spotify catalog information for several audiobook chapters identified by their Spotify IDs.
[REMOVED] Get Several Episodes (GET /episodes) – Get Spotify catalog information for several episodes based on their Spotify IDs.
[REMOVED] Get Several Shows (GET /shows) – Get Spotify catalog information for several shows based on their Spotify IDs.
[REMOVED] Get Several Tracks (GET /tracks) – Get Spotify catalog information for multiple tracks based on their Spotify IDs.
[REMOVED] Get Single Browse Category (GET /browse/categories/{id}) – Get a single category used to tag items in Spotify (on, for example, the Spotify player's "Browse" tab).
[REMOVED] Get User's Playlists (GET /users/{id}/playlists) – Get a list of the playlists owned or followed by a Spotify user.
[REMOVED] Get User's Profile (GET /users/{id}) – Get public profile information about a Spotify user.
[ADDED] Remove from Library (DELETE /me/library) – Remove a list of Spotify URIs from the user's library.
[REMOVED] Remove Albums for Current User (DELETE /me/albums) – Removes albums from the user's library.
Use DELETE /me/library instead
[REMOVED] Remove Audiobooks for Current User (DELETE /me/audiobooks) – Removes audiobooks from the user's library.
Use DELETE /me/library instead
[REMOVED] Remove Episodes for Current User (DELETE /me/episodes) – Removes episodes from the user's library.
Use DELETE /me/library instead
[REMOVED] Remove Shows for Current User (DELETE /me/shows) – Removes shows from the user's library.
Use DELETE /me/library instead
[REMOVED] Remove Tracks for Current User (DELETE /me/tracks) – Removes tracks from the user's library.
Use DELETE /me/library instead
[ADDED] Save to Library (PUT /me/library) – Save a list of Spotify URIs to the user's library.
[REMOVED] Save Albums for Current User (PUT /me/albums) – Saves one or more albums to the user's library.
Use PUT /me/library instead
[REMOVED] Save Audiobooks for Current User (PUT /me/audiobooks) – Saves audiobooks to the user's library.
Use PUT /me/library instead
[REMOVED] Save Episodes for Current User (PUT /me/episodes) – Saves episodes to the user's library.
Use PUT /me/library instead
[REMOVED] Save Shows for Current User (PUT /me/shows) – Saves shows to the user's library.
Use PUT /me/library instead
[REMOVED] Save Tracks for Current User (PUT /me/tracks) – Saves tracks to the user's library.
Use PUT /me/library instead
[ADDED] Check User's Saved Items (GET /me/library/contains) – Check if one or more items are already saved in the current user's library.
[REMOVED] Check If User Follows Artists or Users (GET /me/following/contains) – Check to see if the current user is following one or more artists or other Spotify users.
Use GET /me/library/contains instead
[REMOVED] Check if Current User Follows Playlist (GET /playlists/{id}/followers/contains) – Checks whether the current user follows a given playlist.
Use GET /me/library/contains instead
[REMOVED] Check User's Saved Albums (GET /me/albums/contains) – Checks whether one or more album IDs are saved in the current user's library.
Use GET /me/library/contains instead
[REMOVED] Check User's Saved Audiobooks (GET /me/audiobooks/contains) – Checks whether one or more audiobook IDs are saved in the current user's library.
Use GET /me/library/contains instead
[REMOVED] Check User's Saved Episodes (GET /me/episodes/contains) – Checks whether one or more episode IDs are saved in the current user's library.
Use GET /me/library/contains instead
[REMOVED] Check User's Saved Shows (GET /me/shows/contains) – Checks whether one or more show IDs are saved in the current user's library.
Use GET /me/library/contains instead
[REMOVED] Check User's Saved Tracks (GET /me/tracks/contains) – Checks whether one or more track IDs are saved in the current user's library.
Use GET /me/library/contains instead
[REMOVED] Follow Artists or Users (PUT /me/following) – Follows one or more artists or users.
Use PUT /me/library instead
[REMOVED] Follow Playlist (PUT /playlists/{id}/followers) – Follows a playlist on behalf of the current user.
Use PUT /me/library instead
[REMOVED] Unfollow Artists or Users (DELETE /me/following) – Unfollows one or more artists or users.
Use DELETE /me/library instead
[REMOVED] Unfollow Playlist (DELETE /playlists/{id}/followers) – Unfollows a playlist on behalf of the current user.
Use DELETE /me/library instead
[ADDED] Add Items to Playlist (POST /playlists/{id}/items) – Add one or more items to a user's playlist.
[ADDED] Get Playlist Items (GET /playlists/{id}/items) – Get full details of the items of a playlist.
[ADDED] Remove Playlist Items (DELETE /playlists/{id}/items) – Remove one or more items from a user's playlist.
[ADDED] Update Playlist Items (PUT /playlists/{id}/items) – Either reorder or replace items in a playlist.
[REMOVED] Add Items to Playlist (POST /playlists/{id}/tracks) – Adds tracks or episodes to a playlist.
Use POST /playlists/{id}/items instead
[REMOVED] Get Playlist Items (GET /playlists/{id}/tracks) – Retrieves the tracks or episodes in a playlist.
Use GET /playlists/{id}/items instead
[REMOVED] Remove Playlist Items (DELETE /playlists/{id}/tracks) – Removes tracks or episodes from a playlist.
Use DELETE /playlists/{id}/items instead
[REMOVED] Update Playlist Items (PUT /playlists/{playlist_id}/tracks) – Either reorder or replace items in a playlist.
Use PUT /playlists/{id}/items instead
[CHANGED] Search for Item (GET /search) – The limit parameter maximum value has been reduced from 50 to 10, and the default value has been changed from 20 to 5.
Changes to fields
The following content types and their objects are present in most responses - these changes apply for their occurances in all responses.

Album
[REMOVED] album_group - Describes the relationship between the artist and the album
[REMOVED] available_markets – The markets in which the album is available: ISO 3166-1 alpha-2 country codes.
[REMOVED] external_ids — Known external IDs for the album. Reverted — See March 2026 changelog.
[REMOVED] label – The label associated with the album.
[REMOVED] popularity — The popularity of the album. The value will be between 0 and 100, with 100 being the most popular.
Artist
[REMOVED] followers — Information about the followers of the artist.
[REMOVED] popularity — The popularity of the artist. The value will be between 0 and 100, with 100 being the most popular. The artist's popularity is calculated from the popularity of all the artist's tracks.
Audiobook
[REMOVED] available_markets – A list of the countries in which the audiobook can be played, identified by their ISO 3166-1 alpha-2 code.
[REMOVED] publisher – The publisher of the audiobook.
Chapter
[REMOVED] available_markets – A list of the countries in which the audiobook can be played, identified by their ISO 3166-1 alpha-2 code.
Playlist
Will only return an items object for the user's playlist, other playlists will only provide metadata (not the contents of the playlist) in the response.

[RENAMED] tracks -> items
[RENAMED] tracks.tracks -> items.items
[RENAMED] tracks.tracks.track -> items.items.item
Show
[REMOVED] available_markets – A list of the countries in which the show can be played, identified by their ISO 3166-1 alpha-2 code.
[REMOVED] publisher – The publisher of the show.
Track
[REMOVED] available_markets – A list of the countries in which the track can be played, identified by their ISO 3166-1 alpha-2 code.
[REMOVED] external_ids — Known external IDs for the track. Reverted — See March 2026 changelog.
[REMOVED] linked_from – Original track when relinked.
[REMOVED] popularity — The popularity of the track. The value will be between 0 and 100, with 100 being the most popular.
User
[REMOVED] country – The country of the user, as set in the user's account profile. An ISO 3166-1 alpha-2 country code.
[REMOVED] email – The user's email address, as entered by the user when creating their account.
[REMOVED] explicit_content – The user's explicit content settings.
[REMOVED] followers — Information about the followers of the user.
[REMOVED] product – The user's Spotify subscription level: "premium", "free", etc. (The subscription level "open" can be considered the same as "free".)
Endpoints still available
These endpoints remain available, but the changes mentioned above still apply to them.

Library
Change Playlist Details (PUT /playlists/{id}) – Updates a playlist's name, description, or visibility.
Create Playlist (POST /me/playlists) – Creates a new playlist for logged in users.
Get Current User's Playlists (GET /me/playlists) – Retrieves playlists for the current authenticated user.
Get Followed Artists (GET /me/following) – Retrieves artists followed by the current user.
Get User's Saved Albums (GET /me/albums) – Retrieves albums saved in the user's library.
Get User's Saved Audiobooks (GET /me/audiobooks) – Retrieves audiobooks saved in the user's library.
Get User's Saved Episodes (GET /me/episodes) – Retrieves podcast episodes saved in the user's library.
Get User's Saved Shows (GET /me/shows) – Retrieves podcast shows saved in the user's library.
Get User's Saved Tracks (GET /me/tracks) – Retrieves tracks saved in the user's library.
Remove from Library (DELETE /me/library) – Remove a list of Spotify URIs from the user's library.
Save to Library (PUT /me/library) – Save a list of Spotify URIs to the user's library.
Metadata
Get Album (GET /albums/{id}) – Retrieves detailed metadata for a single album.
Get Album Tracks (GET /albums/{id}/tracks) – Retrieves the tracks contained in a specific album.
Get Artist (GET /artists/{id}) – Retrieves detailed metadata for a single artist.
Get Artist's Albums (GET /artists/{id}/albums) – Retrieves albums released by a specific artist.
Get Audiobook (GET /audiobooks/{id}) – Retrieves detailed metadata for a single audiobook.
Get Audiobook Chapters (GET /audiobooks/{id}/chapters) – Retrieves chapters belonging to a specific audiobook.
Get Chapter (GET /chapters/{id}) – Retrieves metadata for a single audiobook chapter.
Get Episode (GET /episodes/{id}) – Retrieves metadata for a single podcast episode.
Get Show (GET /shows/{id}) – Retrieves metadata for a single podcast show.
Get Show Episodes (GET /shows/{id}/episodes) – Retrieves episodes belonging to a specific podcast show.
Get Track (GET /tracks/{id}) – Retrieves metadata for a single track.
Search for Item (GET /search) – Searches across the Spotify catalog for albums, artists, playlists, tracks, shows, episodes, or audiobooks.
User
Get Current User's Profile (GET /me) – Retrieves profile information for the current authenticated user.
Personalisation
Get User's Top Items (GET /me/top/{type}) – Retrieves the user's top artists or tracks over a given time range.
Player
Add Item to Queue (POST /me/player/queue) – Adds an item to the playback queue.
Get Available Devices (GET /me/player/devices) – Retrieves devices available for playback.
Get Currently Playing Track (GET /me/player/currently-playing) – Retrieves the item currently being played.
Get Playback State (GET /me/player) – Retrieves information about the user's current playback state.
Get Recently Played Tracks (GET /me/player/recently-played) - Get tracks from the current user's recently played tracks.
Get User's Queue (GET /me/player/queue) – Retrieves the current playback queue.
Pause Playback (PUT /me/player/pause) – Pauses playback.
Seek to Position (PUT /me/player/seek) – Seeks to a specific position in the currently playing item.
Set Repeat Mode (PUT /me/player/repeat) – Sets repeat mode for playback.
Set Volume (PUT /me/player/volume) – Sets the playback volume.
Skip to Next (POST /me/player/next) – Skips to the next item in the queue.
Skip to Previous (POST /me/player/previous) – Skips to the previous item.
Start/Resume Playback (PUT /me/player/play) – Starts or resumes playback.
Toggle Shuffle (PUT /me/player/shuffle) – Toggles shuffle mode.
Transfer Playback (PUT /me/player) – Transfers playback to a new device.
Playlist
Get Playlist (GET /playlists/{id}) – Retrieves full details of a playlist.
Get Playlist Cover Image (GET /playlists/{id}/images) – Retrieves the cover image(s) for a playlist.
Upload Custom Playlist Cover Image (PUT /playlists/{id}/images) – Uploads a custom image for a playlist.
See Also
March 2026 Changelog — Reverted changes
February 2026 Migration Guide — Step-by-step migration instructions
Web API Documentation

February 2026 Web API Dev Mode Changes - Migration Guide
This guide is here to help developers with existing apps migrate to the updated Web API following the February 2026 announcement. It covers what's changing, who is affected, and provides step-by-step migration paths for common use cases.

Who is affected?
Extended Quota Mode apps: No migration required. Apps in extended quota mode are not affected by any of the changes described in this guide — all existing endpoints, fields, and behaviors remain unchanged. You can optionally adopt the new generic library endpoints (PUT/DELETE /me/library) but your existing integrations will remain fully functional.

Development Mode apps: This guide is for you. Read on for the full details of what's changing and how to update your app.

Timeline
Date	What happens
February 11, 2026	New Development Mode apps are created with new restrictions
March 9, 2026	Existing Development Mode apps are migrated to new restrictions
Account and App Limit Changes
Premium Requirement
All Development Mode apps require the app owner to have an active Spotify Premium subscription. If the owner's Premium subscription lapses, the app will stop working. It will resume functioning once the owner resubscribes.

App Limits
Requirement	New apps
Client IDs per developer	1
Users per app	5
Existing apps are grandfathered: If you already have multiple Client IDs or more than 5 users, you will retain them. These limits only restrict what you can create or add going forward.

Endpoint Changes
Library Management
The entity type specific save, remove, follow, and unfollow endpoints have been replaced with generic library endpoints that work with Spotify URIs.

Saving items and following
Before:

PUT /me/tracks
PUT /me/albums
PUT /me/episodes
PUT /me/shows
PUT /me/audiobooks
PUT /me/following
PUT /playlists/{id}/followers

After:

PUT /me/library

The new PUT /me/library endpoint accepts Spotify URIs instead of IDs, allowing you to save or follow any supported content type in a single request. Appropriate scopes need to be passed depending on the entities being saved.

Removing items and unfollowing
Before:

DELETE /me/tracks
DELETE /me/albums
DELETE /me/episodes
DELETE /me/shows
DELETE /me/audiobooks
DELETE /me/following
DELETE /playlists/{id}/followers

After:

DELETE /me/library

Like the save endpoint, DELETE /me/library accepts Spotify URIs instead of IDs.

Checking if items are saved
The individual "contains" endpoints have been replaced with a single generic endpoint.

Before:

GET /me/tracks/contains
GET /me/albums/contains
GET /me/episodes/contains
GET /me/shows/contains
GET /me/audiobooks/contains
GET /me/following/contains
GET /playlists/{id}/followers/contains

After:

GET /me/library/contains

The new GET /me/library/contains endpoint accepts Spotify URIs instead of IDs.

Playlist Endpoint Renames
The playlist track management endpoints have been renamed from /tracks to /items:

Removed endpoint	Replacement	Comment
POST /playlists/{id}/tracks	POST /playlists/{id}/items	
GET /playlists/{id}/tracks	GET /playlists/{id}/items	Only available for playlists the user owns or collaborates on. Fields have been renamed in the response, see Playlist field changes for response changes.
DELETE /playlists/{id}/tracks	DELETE /playlists/{id}/items	Parameter tracks renamed to items
PUT /playlists/{playlist_id}/tracks	PUT /playlists/{id}/items	
Batch/Bulk Fetch Endpoints (Removed)
The following batch endpoints are no longer available. Fetch items individually instead.

Removed endpoint	Replacement
GET /tracks	GET /tracks/{id} (one request per track)
GET /albums	GET /albums/{id}
GET /artists	GET /artists/{id}
GET /episodes	GET /episodes/{id}
GET /shows	GET /shows/{id}
GET /audiobooks	GET /audiobooks/{id}
GET /chapters	GET /chapters/{id}
Migration example:

// Before: Batch fetch
const response = await fetch('/v1/tracks?ids=id1,id2,id3');
const { tracks } = await response.json();

// After: Individual fetches
const trackIds = ['id1', 'id2', 'id3'];
const tracks = await Promise.all(
  trackIds.map(id =>
    fetch(`/v1/tracks/${id}`).then(r => r.json())
  )
);

Browse and Artist Endpoints (Removed)
Removed endpoint	Description
GET /browse/new-releases	New album releases
GET /browse/categories	Browse categories list
GET /browse/categories/{id}	Single category details
GET /artists/{id}/top-tracks	Artist's top tracks by country
Other User Data (Removed)
Removed endpoint	Replacement
GET /users/{id}	No replacement - use GET /me for current user
GET /users/{id}/playlists	No replacement - use GET /me/playlists for current user
POST /users/{user_id}/playlists	POST /me/playlists
GET /markets	No replacement
Search Endpoint
The GET /search endpoint's limit parameter has been updated:

Parameter	Before	After
limit maximum	50	10
limit default	20	5
If your app relies on fetching more than 10 results per search request, you will need to paginate through results using the offset parameter.

Field Changes by Content Type
The following field changes apply across all endpoints that return these content types.

Removed fields
The following fields have been removed from response objects. Update your code to handle their absence gracefully.

Track
available_markets, external_ids (reverted — see March 2026 changelog), linked_from, popularity

Album
album_group, available_markets, external_ids (reverted — see March 2026 changelog), label, popularity

Artist
followers, popularity

User (from GET /me)
country, email, explicit_content, followers, product

Show
available_markets, publisher

Audiobook / Chapter
available_markets, publisher (audiobook only)

Renamed fields
Playlist
The tracks field has been renamed:

Before	After
tracks	items
tracks.tracks	items.items
tracks.tracks.track	items.items.item
Important: Playlist contents (items) are only returned for playlists the user owns or collaborates on. For other playlists, only metadata is returned and the items field will be absent from the response.

Migration Checklist
Use this checklist to ensure your app is ready:

 Account: Ensure the app owner has Spotify Premium
 Library endpoints: Replace content-specific save/remove/follow/unfollow calls with PUT/DELETE /me/library
 Contains checks: Replace content-specific "contains" calls with GET /me/library/contains
 Batch fetches: Replace batch endpoints with individual fetch calls
 Browse and artist endpoints: Remove features using browse categories, new releases, or artist top tracks
 Other users: Remove features that fetch other users' profiles or playlists
 Playlist endpoints: Update /playlists/{id}/tracks calls to /playlists/{id}/items
 Playlist handling: Update code for the tracks → items field rename
 Removed fields: Handle missing fields gracefully (check for undefined/null)
 Search pagination: Update search requests to handle the reduced limit maximum (10) and paginate if needed
 Global recommendation: Limit API calls to avoid hitting rate limits
Common Migration Patterns
Pattern 1: Updating library save calls
// Before
await spotify.put('/me/tracks', { ids: ['trackId1', 'trackId2'] });
await spotify.put('/me/albums', { ids: ['albumId1'] });
await spotify.put('/me/following', { ids: ['artistId1'], type: 'artist' });

// After — all entity types in a single call
await spotify.put('/me/library', {
  uris: [
    'spotify:track:trackId1',
    'spotify:track:trackId2',
    'spotify:album:albumId1',
    'spotify:artist:artistId1'
  ]
});

Pattern 2: Handling missing popularity field
// Before
const sortedTracks = tracks.sort((a, b) => b.popularity - a.popularity);

// After - popularity is no longer available
// Consider alternative sorting criteria or remove this feature
const sortedTracks = tracks.sort((a, b) =>
  a.name.localeCompare(b.name)
);

Pattern 3: Handling playlist field rename
// Before
const trackCount = playlist.tracks.total;
const firstTrack = playlist.tracks.items[0].track;

// After
const trackCount = playlist.items?.total ?? 0;
const firstTrack = playlist.items?.items?.[0]?.item;

// Note: items may be undefined for playlists you don't own
if (!playlist.items) {
  console.log('Track details not available for this playlist');
}

Need Help?
Full list of available endpoints
Developer Community forum