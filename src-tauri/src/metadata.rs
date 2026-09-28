use lofty::{
    file::AudioFile,
    prelude::*,
    probe::Probe,
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
    pub duration_ms: i64,
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

    let duration_ms = tagged_file
        .properties()
        .duration()
        .as_millis() as i64;

    Ok(TrackMetadata {
        title,
        artist,
        album,
        genre,
        track_number,
        disc_number,
        duration_ms,
    })
}