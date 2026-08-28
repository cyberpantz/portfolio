from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "models" / "weather-vibe" / "landmarks"


def safe_name(name):
    return (
        name.lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace(".", "_")
    )


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_material(name, color, roughness=0.72, metallic=0.0):
    material = bpy.data.materials.new(safe_name(name))
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def add_beam(name, start, end, radius, material, vertices=6):
    start_v = Vector(start)
    end_v = Vector(end)
    center = (start_v + end_v) * 0.5
    direction = end_v - start_v

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=center,
    )
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    return obj


def add_box(name, location, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = safe_name(name)
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def create_iron_tower():
    clear_scene()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    iron = make_material("weathered dark iron", (0.12, 0.105, 0.085, 1), metallic=0.15)
    warm_light = make_material("warm signal lights", (1.0, 0.68, 0.34, 1), roughness=0.45)

    height = 3.2
    base = 0.92
    waist = 0.32
    crown = 0.14

    levels = [
        (0.0, base),
        (0.95, 0.58),
        (1.95, waist),
        (2.75, crown),
    ]

    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]

    for x_sign, z_sign in corners:
        points = [(x_sign * width, z_sign * width, y) for y, width in levels]
        for index in range(1, len(points)):
            p0 = points[index - 1]
            p1 = points[index]
            add_beam(f"leg {x_sign} {z_sign} {index}", (p0[0], p0[2], p0[1]), (p1[0], p1[2], p1[1]), 0.035, iron)

    for y, width in levels[1:]:
        add_box(f"platform {y}", (0, y, 0), (width * 2.2, 0.055, width * 2.2), iron)

    for lower, upper in zip(levels, levels[1:]):
        y0, w0 = lower
        y1, w1 = upper
        for i in range(4):
            a = corners[i]
            b = corners[(i + 1) % 4]
            p0 = (a[0] * w0, y0 + 0.08, a[1] * w0)
            p1 = (b[0] * w1, y1 - 0.08, b[1] * w1)
            add_beam(f"brace a {y0} {i}", p0, p1, 0.018, iron, vertices=5)
            p2 = (b[0] * w0, y0 + 0.08, b[1] * w0)
            p3 = (a[0] * w1, y1 - 0.08, a[1] * w1)
            add_beam(f"brace b {y0} {i}", p2, p3, 0.018, iron, vertices=5)

    add_beam("antenna mast", (0, 2.68, 0), (0, height, 0), 0.024, iron, vertices=6)

    for y in (0.95, 1.95, 2.75):
        for angle in (0, math.pi / 2):
            add_beam(
                f"signal light {y} {angle}",
                (math.cos(angle) * 0.08, y + 0.035, math.sin(angle) * 0.08),
                (math.cos(angle) * 0.14, y + 0.035, math.sin(angle) * 0.14),
                0.018,
                warm_light,
                vertices=8,
            )

    add_box("ground shadow plinth", (0, -0.025, 0), (1.95, 0.04, 1.95), iron)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

    bpy.ops.export_scene.gltf(
        filepath=str(OUT_DIR / "iron-tower.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=False,
    )


if __name__ == "__main__":
    create_iron_tower()
