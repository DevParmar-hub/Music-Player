use lofty::{
    file::AudioFile,
    picture::PictureType,
    prelude::*,
    probe::Probe,
    tag::Tag,
};
use std::path::Path;

#[derive(Debug)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
    pub year: Option<u32>,
    pub duration_ms: i64,
    /// Raw bytes of the embedded cover image, if any.
    pub picture: Option<Vec<u8>>,
}

pub fn read_metadata(path: &Path) -> Result<TrackMetadata, String> {
    let tagged_file = Probe::open(path)
        .map_err(|error| error.to_string())?
        .read()
        .map_err(|error| error.to_string())?;

    let tag = tagged_file.primary_tag();

    let title = tag
        .and_then(|tag| tag.title())
        .map(|value| value.to_string());

    let artist = tag
        .and_then(|tag| tag.artist())
        .map(|value| value.to_string());

    let album = tag
        .and_then(|tag| tag.album())
        .map(|value| value.to_string());

    let genre = tag
        .and_then(|tag| tag.genre())
        .map(|value| value.to_string());

    let track_number = tag
        .and_then(|tag| tag.track());

    let disc_number = tag
        .and_then(|tag| tag.disk());

    let year = tag
        .and_then(|tag| tag.year());

    let duration_ms = tagged_file
        .properties()
        .duration()
        .as_millis() as i64;

    // The primary tag usually holds the cover, but some files only
    // carry it in a secondary tag (e.g. ID3v2 alongside APE).
    let picture = tag
        .and_then(cover_picture)
        .or_else(|| tagged_file.tags().iter().find_map(cover_picture));

    Ok(TrackMetadata {
        title,
        artist,
        album,
        genre,
        track_number,
        disc_number,
        year,
        duration_ms,
        picture,
    })
}

/// Prefer the front cover; fall back to whatever picture exists.
fn cover_picture(tag: &Tag) -> Option<Vec<u8>> {
    let pictures = tag.pictures();

    pictures
        .iter()
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| pictures.first())
        .map(|picture| picture.data().to_vec())
}
