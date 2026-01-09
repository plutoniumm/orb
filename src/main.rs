mod planets;

use bevy::input::mouse::{MouseMotion, MouseWheel};
use bevy::prelude::*;
use planets::{spawn_solar_system, CelestialBody, Velocity};

const G_CONST: f32 = 1.0;
const TIME_STEP: f32 = 0.01;

#[derive(Resource)]
struct SimulationState {
    paused: bool,
    focus_target: Option<Entity>,
    camera_zoom: f32,
    camera_offset: Vec2,
}

impl Default for SimulationState {
    fn default() -> Self {
        Self {
            paused: false,
            focus_target: None,
            camera_zoom: 100.0,
            camera_offset: Vec2::ZERO,
        }
    }
}

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Bevy Solar System Simulator".into(),
                resolution: (1280.0, 720.0).into(),
                ..default()
            }),
            ..default()
        }))
        .init_resource::<SimulationState>()
        .insert_resource(ClearColor(Color::BLACK))
        .add_systems(Startup, setup)
        .add_systems(
            Update,
            (
                gravity_physics,
                update_positions,
                handle_input,
                camera_follow,
                draw_trails,
            )
                .chain(),
        )
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    mut sim_state: ResMut<SimulationState>,
) {
    commands.spawn(Camera2d);

    spawn_solar_system(&mut commands, &mut meshes, &mut materials);
}


fn gravity_physics(
    mut query: Query<(Entity, &mut Velocity, &Transform, &CelestialBody)>,
    all_bodies: Query<(Entity, &Transform, &CelestialBody)>,
) {
    let mut accelerations = Vec::new();

    for (e1, _, t1, _) in &query {
        let mut acc = Vec2::ZERO;
        let pos1 = t1.translation.truncate();

        for (e2, t2, b2) in &all_bodies {
            if e1 == e2 {
                continue;
            }

            let pos2 = t2.translation.truncate();
            let delta = pos2 - pos1;
            let dist_sq = delta.length_squared();
            let dist = dist_sq.sqrt();

            if dist > 0.0001 {
                // F = G * m1 * m2 / r^2
                // a1 = F / m1 = G * m2 / r^2
                // Direction is delta / dist
                let force_mag = G_CONST * b2.mass / dist_sq;
                acc += delta.normalize() * force_mag;
            }
        }
        accelerations.push((e1, acc));
    }

    for (entity, acc) in accelerations {
        if let Ok((_, mut vel, _, _)) = query.get_mut(entity) {
            vel.0 += acc * TIME_STEP;
        }
    }
}

fn update_positions(mut query: Query<(&mut Transform, &Velocity)>) {
    for (mut transform, velocity) in &mut query {
        let movement = velocity.0 * TIME_STEP;
        transform.translation.x += movement.x;
        transform.translation.y += movement.y;
    }
}

fn handle_input(
    mut commands: Commands,
    mouse_input: Res<ButtonInput<MouseButton>>,
    mut mouse_motion: EventReader<MouseMotion>,
    mut mouse_wheel: EventReader<MouseWheel>,
    window: Single<&Window>,
    camera: Single<(&Camera, &GlobalTransform)>,
    bodies: Query<(Entity, &Transform, &CelestialBody)>,
    mut sim_state: ResMut<SimulationState>,
) {
    let (cam, cam_transform) = *camera;

    for event in mouse_wheel.read() {
        sim_state.camera_zoom += event.y * 2.0;
        sim_state.camera_zoom = sim_state.camera_zoom.clamp(5.0, 500.0);
    }

    if mouse_input.pressed(MouseButton::Right) {
        for event in mouse_motion.read() {
            sim_state.camera_offset.x -= event.delta.x / sim_state.camera_zoom;
            sim_state.camera_offset.y += event.delta.y / sim_state.camera_zoom;
        }
    }

    if mouse_input.just_pressed(MouseButton::Left) {
        if let Some(cursor_position) = window.cursor_position() {
            if let Ok(world_pos) = cam.viewport_to_world_2d(cam_transform, cursor_position) {

                let mut clicked_body = None;

                for (entity, transform, body) in &bodies {
                    let planet_pos = transform.translation.truncate();
                    let dist = world_pos.distance(planet_pos);

                    if dist < (body.radius * 2.0).max(0.5) {
                        clicked_body = Some(entity);
                        break;
                    }
                }

                if let Some(e) = clicked_body {
                    sim_state.focus_target = Some(e);
                    sim_state.camera_offset = Vec2::ZERO;
                    println!("Focused on planet: {:?}", e);
                } else {
                    // Clicking empty space could clear focus, or do nothing.
                    // sim_state.focus_target = None;
                }
            }
        }
    }
}

fn camera_follow(
    mut camera_query: Query<&mut Transform, With<Camera>>,
    target_query: Query<&Transform, (With<CelestialBody>, Without<Camera>)>,
    sim_state: Res<SimulationState>,
) {
    let mut cam_transform = camera_query.single_mut();
    let scale = 50.0 / sim_state.camera_zoom;
    cam_transform.scale = Vec3::splat(scale);

    let mut target_pos = Vec2::ZERO;

    if let Some(target_entity) = sim_state.focus_target {
        if let Ok(t) = target_query.get(target_entity) {
            target_pos = t.translation.truncate();
        }
    }

    cam_transform.translation.x = target_pos.x + sim_state.camera_offset.x;
    cam_transform.translation.y = target_pos.y + sim_state.camera_offset.y;
}

#[derive(Component)]
struct Trail {
    points: Vec<Vec2>,
    timer: Timer,
}

fn draw_trails(
    mut gizmos: Gizmos,
    query: Query<(&Transform, &CelestialBody)>,
    sim_state: Res<SimulationState>,
) {
    for (transform, body) in &query {
        gizmos.circle_2d(
            transform.translation.truncate(),
            body.radius,
            body.color,
        );
    }
}