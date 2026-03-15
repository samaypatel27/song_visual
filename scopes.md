Scopes
Scopes provide Spotify users using third-party apps the confidence that only the information they choose to share will be shared, and nothing more.

Pre-requisites
Scopes are needed when implementing some of the authorization grant types. Make sure you have read the Authorization guide to understand the basics.

List of Scopes
Images
ugc-image-upload
Spotify Connect
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
Playback
app-remote-control
streaming
Playlists
playlist-read-private
playlist-read-collaborative
playlist-modify-private
playlist-modify-public
Follow
user-follow-modify
user-follow-read
Listening History
user-read-playback-position
user-top-read
user-read-recently-played
Library
user-library-modify
user-library-read
Users
user-read-email
user-read-private
user-personalized
Open Access
user-soa-link
user-soa-unlink
soa-manage-entitlements
soa-manage-partner
soa-create-partner
ugc-image-upload
Description	Write access to user-provided images.
Visible to users	Upload images to Spotify on your behalf.
Endpoints that require the ugc-image-upload scope

Add Custom Playlist Cover Image
user-read-playback-state
Description	Read access to a user’s player state.
Visible to users	Read your currently playing content and Spotify Connect devices information.
Endpoints that require the user-read-playback-state scope

Get a User's Available Devices
Get Information About The User's Current Playback
Get the User's Currently Playing Track
user-modify-playback-state
Description	Write access to a user’s playback state
Visible to users	Control playback on your Spotify clients and Spotify Connect devices.
Endpoints that require the user-modify-playback-state scope

Pause a User's Playback
Seek To Position In Currently Playing Track
Set Repeat Mode On User’s Playback
Set Volume For User's Playback
Skip User’s Playback To Next Track
Skip User’s Playback To Previous Track
Start/Resume a User's Playback
Toggle Shuffle For User’s Playback
Transfer a User's Playback
Add An Item To The End Of User's Current Playback Queue
user-read-currently-playing
Description	Read access to a user’s currently playing content.
Visible to users	Read your currently playing content.
Endpoints that require the user-read-currently-playing scope

Get the User's Currently Playing Track
Get the User's Queue
app-remote-control
Description	Remote control playback of Spotify. This scope is currently available to Spotify iOS and Android SDKs.
Visible to users	Communicate with the Spotify app on your device.
Endpoints that require the app-remote-control scope

iOS SDK
Android SDK
streaming
Description	Control playback of a Spotify track. This scope is currently available to the Web Playback SDK. The user must have a Spotify Premium account.
Visible to users	Play content and control playback on your other devices.
Endpoints that require the streaming scope

Web Playback SDK
playlist-read-private
Description	Read access to user's private playlists.
Visible to users	Access your private playlists.
Endpoints that require the playlist-read-private scope

Check if Users Follow a Playlist
Get a List of Current User's Playlists
Get a List of a User's Playlists
playlist-read-collaborative
Description	Include collaborative playlists when requesting a user's playlists.
Visible to users	Access your collaborative playlists.
Endpoints that require the playlist-read-collaborative scope

Get a List of Current User's Playlists
Get a List of a User's Playlists
playlist-modify-private
Description	Write access to a user's private playlists.
Visible to users	Manage your private playlists.
Endpoints that require the playlist-modify-private scope

Follow a Playlist
Unfollow a Playlist
Add Items to a Playlist
Change a Playlist's Details
Create a Playlist
Remove Items from a Playlist
Reorder a Playlist's Items
Replace a Playlist's Items
Upload a Custom Playlist Cover Image
playlist-modify-public
Description	Write access to a user's public playlists.
Visible to users	Manage your public playlists.
Endpoints that require the playlist-modify-public scope

Follow a Playlist
Unfollow a Playlist
Add Items to a Playlist
Change a Playlist's Details
Create a Playlist
Remove Items from a Playlist
Reorder a Playlist's Items
Replace a Playlist's Items
Upload a Custom Playlist Cover Image
user-follow-modify
Description	Write/delete access to the list of artists and other users that the user follows.
Visible to users	Manage who you are following.
Endpoints that require the user-follow-modify scope

Follow Artists or Users
Unfollow Artists or Users
user-follow-read
Description	Read access to the list of artists and other users that the user follows.
Visible to users	Access your followers and who you are following.
Endpoints that require the user-follow-read scope

Check if Current User Follows Artists or Users
Get User's Followed Artists
user-read-playback-position
Description	Read access to a user’s playback position in a content.
Visible to users	Read your position in content you have played.
Endpoints that require the user-read-playback-position scope

Get an Episodes
Get Several Episodes
Get a Show
Get Several Shows
Get a Show's Episodes
user-top-read
Description	Read access to a user's top artists and tracks.
Visible to users	Read your top artists and content.
Endpoints that require the user-top-read scope

Get a User's Top Artists and Tracks
user-read-recently-played
Description	Read access to a user’s recently played tracks.
Visible to users	Access your recently played items.
Endpoints that require the user-read-recently-played scope

Get Current User's Recently Played Tracks
user-library-modify
Description	Write/delete access to a user's "Your Music" library.
Visible to users	Manage your saved content.
Endpoints that require the user-library-modify scope

Remove Albums for Current User
Remove User's Saved Tracks
Remove User's Saved Episodes
Save Albums for Current User
Save Tracks for User
Save Episodes for User
user-library-read
Description	Read access to a user's library.
Visible to users	Access your saved content.
Endpoints that require the user-library-read scope

Check User's Saved Albums
Check User's Saved Tracks
Get Current User's Saved Albums
Get a User's Saved Tracks
Check User's Saved Episodes
Get User's Saved Episodes
user-read-email
Description	Read access to user’s email address.
Visible to users	Get your real email address.
Endpoints that require the user-read-email scope

Get Current User's Profile
user-read-private
Description	Read access to user’s subscription details (type of user account).
Visible to users	Access your subscription details.
Endpoints that require the user-read-private scope

Search for an Item
Get Current User's Profile
user-personalized
Description	Get personalized content for the user.
user-soa-link
Description	Link a partner user account to a Spotify user account
Endpoints that require the user-soa-link scope

Register new user
user-soa-unlink
Description	Unlink a partner user account from a Spotify account
Endpoints that require the user-soa-unlink scope

Unlink user
soa-manage-entitlements
Description	Modify entitlements for linked users
Endpoints that require the soa-manage-entitlements scope

Add user entitlements
Get user entitlements
Removes user entitlements
Replace user entitlements
soa-manage-partner
Description	Update partner information
Endpoints that require the soa-manage-partner scope

Set partner logo
soa-create-partner
Description	Create new partners, platform partners only
Endpoints that require the soa-create-partner scope

Create new partner