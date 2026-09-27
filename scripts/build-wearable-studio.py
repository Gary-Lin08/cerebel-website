"""Prepare Cerebel's supplied CAD geometry for a scroll-directed product stage.

Run with Blender --background <source.blend> --python scripts/build-wearable-studio.py.
The source file is never overwritten. Material choices are presentation treatments.
"""
import bpy
import bmesh
import math
import os
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/wearable-studio"
EDIT = ROOT / "assets/blender"
OUT.mkdir(parents=True, exist_ok=True)
EDIT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
source_meshes = [o for o in scene.objects if o.type == "MESH"]
assert len(source_meshes) > 100, "Open the original Cerebel CAD scene first."

def material(name, color, metallic=0, roughness=.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return m

shell = material("Satin graphite", (.022, .026, .034), .38, .25)
lens = material("Optical smoke", (.20, .29, .35), .48, .12)
next(n for n in lens.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs["Coat Weight"].default_value = .8
next(n for n in lens.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs["Transmission Weight"].default_value = .35
metal = material("Brushed titanium", (.39, .43, .49), .8, .23)
core = material("Cerebel signal violet", (.27, .09, .58), .52, .23)
board = material("Circuit substrate", (.038, .055, .062), .30, .34)

groups = {k: [] for k in ["Frame", "Lenses", "Temple_L", "Temple_R", "Capture_module", "Optical_components", "Electronics"]}
center = Vector((.0005, -.006393644, .081171368))
normalize = Matrix(((24,0,0,0),(0,0,24,0),(0,-24,0,0),(0,0,0,1))) @ Matrix.Translation(-center)
for obj in source_meshes:
    part = int(obj.name.split("_")[-1])
    obj.data.transform(normalize @ obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    if part in (10, 11): group, mat = "Lenses", lens
    elif part in (0,4,7): group, mat = "Frame", shell
    elif part in (14,15): group, mat = "Temple_L", shell
    elif part in (19,20): group, mat = "Temple_R", shell
    elif part == 598: group, mat = "Capture_module", shell
    elif part in (8,9,18,592,593,599,600,601,602): group, mat = "Optical_components", core
    else: group, mat = "Electronics", board if part > 25 and part < 591 else metal
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000025)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    if len(obj.data.polygons) > 700:
        modifier = obj.modifiers.new("Web geometry reduction", "DECIMATE")
        modifier.ratio = .32 if group != "Electronics" else .16
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    groups[group].append(obj)

rig = bpy.data.objects.new("Cerebel_Studio_Rig", None)
scene.collection.objects.link(rig)
exports = [rig]
displacements = {"Frame":(0,-.12,0),"Lenses":(0,-.8,0),"Temple_L":(-.48,.08,0),"Temple_R":(.48,.08,0),"Capture_module":(0,0,.84),"Optical_components":(0,-.22,.1),"Electronics":(0,0,.25)}
for name, objects in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.parent = rig
    exports.append(obj)
    obj["presentation_group"] = name
    obj["explosion_vector"] = displacements[name]
    for frame, amount in [(1,0),(120,0),(260,0),(360,0),(460,1),(520,1)]:
        obj.location = Vector(displacements[name]) * amount
        obj.keyframe_insert(data_path="location", frame=frame)

for frame, degrees in [(1,-26),(120,-8),(260,20),(360,-22),(460,-28),(520,-18)]:
    rig.rotation_euler = (0,0,math.radians(degrees))
    rig.keyframe_insert(data_path="rotation_euler", frame=frame)

scene.frame_start, scene.frame_end = 1, 520
scene.render.fps = 30
for name, frame in [("01 · Wearable",1),("02 · Capture",121),("03 · Architecture",261),("04 · Inside out",361)]:
    scene.timeline_markers.new(name, frame=frame)
scene.frame_set(1)

# A dedicated studio camera and softboxes; existing source geometry is preserved.
for obj in list(scene.objects):
    if obj.type in ("CAMERA", "LIGHT"):
        obj.hide_render = True
camera_data = bpy.data.cameras.new("Cerebel product camera")
camera = bpy.data.objects.new("Cerebel product camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (5,-8,5)
camera.rotation_euler = (Vector((0,0,0))-camera.location).to_track_quat("-Z","Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 7.6
scene.camera = camera

def softbox(name, position, energy, color, size, size_y):
    light = bpy.data.lights.new(name, "AREA")
    light.energy, light.color = energy, color
    light.shape, light.size, light.size_y = "RECTANGLE", size, size_y
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat("-Z", "Y").to_euler()

softbox("Long silver key", (1,-4,7), 1700, (.91,.95,1), 7,2)
softbox("Edge strip", (-4,1,4), 1500, (.8,.86,1), 5,1)
softbox("Violet bounce", (4,2,1), 600, (.52,.3,1), 3,3)
scene.world.use_nodes = True
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (.65,.68,.74,1)
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[1].default_value = .35
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 1400, 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"

bpy.ops.object.select_all(action="DESELECT")
for obj in exports: obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(OUT / "cerebel-wearable-v1.glb"), export_format="GLB", use_selection=True, export_animations=False, export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=str(EDIT / "Cerebel_Wearable_Studio.blend"))
print("CEREBEL_EXPORT",len(exports)-1,"groups",sum(len(o.data.vertices) for o in exports if o.type=="MESH"),"vertices",flush=True)
scene.render.filepath = str(OUT / "studio-poster.png")
bpy.ops.render.render(write_still=True)
scene.frame_set(460)
scene.render.filepath = str(OUT / "studio-exploded.png")
bpy.ops.render.render(write_still=True)
print("CEREBEL_STUDIO_COMPLETE",flush=True)
