use bevy::prelude::*;

#[derive(Component, Debug, Clone)]
pub struct CelestialBody {
    pub name: String,
    pub mass: f32,
    pub radius: f32,
    pub color: Color,
}

#[derive(Component, Debug, Clone, Copy)]
pub struct Velocity(pub Vec2);

const G: f32 = 4.0 * std::f32::consts::PI * std::f32::consts::PI; // G in AU^3 / (yr^2 * SolarMass) roughly
const SOL_MASS: f32 = 1.0;
const EARTH_MASS: f32 = 3.003e-6; // Solar masses

pub fn spawn_solar_system(commands: &mut Commands, meshes: &mut ResMut<Assets<Mesh>>, materials: &mut ResMut<Assets<ColorMaterial>>) {
    let bodies = vec![
        (
            "Sun",
            SOL_MASS,
            0.5, // Visual radius
            Color::srgb(1.0, 0.9, 0.0),
            Vec2::ZERO,
            Vec2::ZERO,
        ),
        (
            "Mercury",
            0.166 * EARTH_MASS,
            0.1,
            Color::srgb(0.7, 0.7, 0.7),
            Vec2::new(0.39, 0.0),
            Vec2::new(0.0, 1.59), // Velocity roughly sqrt(1/r) scaled
        ),
        (
            "Venus",
            0.815 * EARTH_MASS,
            0.2,
            Color::srgb(0.9, 0.8, 0.6),
            Vec2::new(0.72, 0.0),
            Vec2::new(0.0, 1.18),
        ),
        (
            "Earth",
            EARTH_MASS,
            0.2,
            Color::srgb(0.2, 0.4, 1.0),
            Vec2::new(1.0, 0.0),
            Vec2::new(0.0, 1.0), // 1 AU/yr approx
        ),
        (
            "Mars",
            0.107 * EARTH_MASS,
            0.15,
            Color::srgb(0.8, 0.3, 0.2),
            Vec2::new(1.52, 0.0),
            Vec2::new(0.0, 0.808),
        ),
        (
            "Jupiter",
            317.8 * EARTH_MASS,
            0.4,
            Color::srgb(0.8, 0.6, 0.4),
            Vec2::new(5.20, 0.0),
            Vec2::new(0.0, 0.439),
        ),
        (
            "Saturn",
            95.2 * EARTH_MASS,
            0.35,
            Color::srgb(0.9, 0.8, 0.5),
            Vec2::new(9.58, 0.0),
            Vec2::new(0.0, 0.325),
        ),
    ];

    for (name, mass, radius, color, pos, vel) in bodies {
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