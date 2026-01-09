use bevy::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Component)]
pub struct CelestialBody {
    pub name: String,
    pub mass: f32,
    pub radius: f32,
    pub color: Color,
}

#[derive(Component, Debug, Clone, Copy)]
pub struct Velocity(pub Vec2);

const SOL: f32 = 1.0;
const M_E: f32 = 3.003e-6;

const PLANETS: &str = include_str!("../data/planets.json");

#[derive(Debug, Deserialize)]
struct PlanetsFile {
    planets: HashMap<String, PlanetState>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
struct PlanetState {
    pos: [f32; 2],
    vel: [f32; 2],
}

fn load_planets() -> HashMap<String, PlanetState> {
    let parsed: PlanetsFile = serde_json::from_str(PLANETS).expect("Failed to parse planets.json");

    parsed.planets
}

fn vec2_from_arr(a: [f32; 2]) -> Vec2 {
    Vec2::new(a[0], a[1])
}

const DAYS_PER_YEAR: f32 = 365.2422;

pub fn spawn_solar_system(
    commands: &mut Commands,
    meshes: &mut ResMut<Assets<Mesh>>,
    materials: &mut ResMut<Assets<ColorMaterial>>,
) {
    let planet_states = load_planets();

    // name, mass, radius, color
    let bodies = vec![
        ("sun", SOL, 0.1, Color::srgb(1.0, 0.9, 0.0)),
        ("mercury", 0.166 * M_E, 0.03, Color::srgb(0.7, 0.7, 0.7)),
        ("venus", 0.815 * M_E, 0.05, Color::srgb(0.9, 0.8, 0.6)),
        ("earth", M_E, 0.05, Color::srgb(0.2, 0.4, 1.0)),
        ("mars", 0.107 * M_E, 0.05, Color::srgb(0.8, 0.3, 0.2)),
        ("jupiter", 317.8 * M_E, 0.1, Color::srgb(0.8, 0.6, 0.4)),
        ("saturn", 95.2 * M_E, 0.1, Color::srgb(0.9, 0.8, 0.5)),
        ("uranus", 14.536 * M_E, 0.1, Color::srgb(0.6, 0.8, 0.9)),
        ("neptune", 17.147 * M_E, 0.1, Color::srgb(0.3, 0.5, 0.9)),
    ];

    for (name, mass, radius, color) in bodies {
        let (pos, vel) = if name == "sun" {
            (Vec2::ZERO, Vec2::ZERO)
        } else {
            let state = planet_states
                .get(name)
                .unwrap_or_else(|| panic!("Missing planet '{name}' in data/planets.json"));

            let pos = vec2_from_arr(state.pos);
            let vel = vec2_from_arr(state.vel) * DAYS_PER_YEAR;
            (pos, vel)
        };

        commands.spawn((
            CelestialBody {
                name: name.to_string(),
                mass,
                radius,
                color,
            },
            Velocity(vel),
            Mesh2d(meshes.add(Circle::new(radius))),
            MeshMaterial2d(materials.add(ColorMaterial::from(color))),
            Transform::from_translation(pos.extend(0.0)),
        ));
    }
}
