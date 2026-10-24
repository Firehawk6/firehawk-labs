import { visitorMarkers } from "./visitor-markers.mjs";
interface VisitorData { total: number; today: number; countries: Array<{ code: string; count: number }>; since: string; locations?: Array<{ code: string; lat: number; lon: number; count: number }>; }
interface Country { name: string; lat: number; lon: number; }
export async function mountVisitorGlobe() {
  const canvas = document.querySelector<HTMLCanvasElement>("#visitor-globe-canvas");
  if (!canvas) return;
  const note = document.querySelector<HTMLElement>("#visitor-note")!;
  const signal = document.querySelector<HTMLElement>("#visitor-signal")!;
  const button = document.querySelector<HTMLButtonElement>("#globe-pause")!;
  let countries: Record<string, Country> = {};
  let updateMarkers = (_data: VisitorData) => {};
  let latest: VisitorData | undefined;
  let stopped = false;
  let inFlight = false;
  const controller = new AbortController();
  const refresh = async () => {
    if (stopped || document.hidden || inFlight) return;
    inFlight = true;
    try {
      const response = await fetch("/api/visitors", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Collector unavailable");
      const data: VisitorData = await response.json();
      if (!Number.isSafeInteger(data.total) || !Number.isSafeInteger(data.today) || !Array.isArray(data.countries)) throw new Error("Invalid totals");
      latest = data;
      for (const [id, value] of [["visits-total", data.total], ["visits-today", data.today], ["visits-countries", data.countries.length]] as const) {
        document.getElementById(id)!.textContent = value.toLocaleString();
      }
      signal.textContent = "RECORDED ACTIVITY";
      note.textContent = data.total ? `Tracking since ${data.since}. Approximate locations refresh every minute.` : "No visits recorded yet. The first visits will light up the globe.";
      const list = document.getElementById("visitor-countries")!;
      list.replaceChildren(...data.countries.slice(0, 5).map(item => {
        const li = document.createElement("li");
        const name = document.createElement("span"); name.textContent = countries[item.code]?.name ?? item.code;
        const count = document.createElement("span"); count.textContent = item.count.toLocaleString();
        li.append(name, count); return li;
      }));
      updateMarkers(data);
    } catch {
      signal.textContent = latest ? "UPDATE UNAVAILABLE" : "AWAITING ACTIVITY";
      note.textContent = latest ? "Showing the last received totals. Updates are temporarily unavailable." : "Visitor activity isn’t available yet. No visits are being displayed.";
    } finally { inFlight = false; }
  };
  try {
    const response = await fetch("/data/countries.json", { signal: controller.signal });
    if (response.ok) countries = await response.json();
  } catch { /* Numeric totals still work without map labels. */ }
  const interval = window.setInterval(refresh, 60000);
  window.addEventListener("firehawk:visit-recorded", refresh);
  document.addEventListener("visibilitychange", refresh);
  void refresh();
  let dispose = () => {};
  window.addEventListener("pagehide", () => {
    stopped = true; controller.abort(); clearInterval(interval); dispose();
    window.removeEventListener("firehawk:visit-recorded", refresh);
    document.removeEventListener("visibilitychange", refresh);
  }, { once: true });
  try {
    const { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Object3D, Color, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, Vector3, WebGLRenderer } = await import("three");
    const response = await fetch("/data/world-outline.json", { signal: controller.signal });
    if (!response.ok) throw new Error("Map unavailable");
    const outlines: number[][][] = await response.json();
    if (stopped) return;
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, .1, 20); camera.position.z = 3.4;
    const globe = new Group(); globe.rotation.y = .7; scene.add(globe);
    const sphere = new Mesh(new SphereGeometry(1, 48, 32), new MeshBasicMaterial({ color: 0x181114 })); globe.add(sphere);
    const position = (lat: number, lon: number, radius = 1.006) => {
      const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
      return new Vector3(radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(theta));
    };
    const outlinePoints: number[] = [];
    for (const line of outlines) for (let i = 1; i < line.length; i++) {
      outlinePoints.push(...position(line[i-1][1], line[i-1][0]).toArray(), ...position(line[i][1], line[i][0]).toArray());
    }
    const geometry = new BufferGeometry();geometry.setAttribute("position", new Float32BufferAttribute(outlinePoints, 3));
    globe.add(new LineSegments(geometry, new LineBasicMaterial({ color: 0xe88b83, transparent: true, opacity: .65 })));
    const gridPoints: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 3) gridPoints.push(...position(lat,lon).toArray(),...position(lat,lon+3).toArray());
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -90; lat < 90; lat += 3) gridPoints.push(...position(lat,lon).toArray(),...position(lat+3,lon).toArray());
    const gridGeometry = new BufferGeometry();gridGeometry.setAttribute("position",new Float32BufferAttribute(gridPoints,3));
    globe.add(new LineSegments(gridGeometry,new LineBasicMaterial({color:0x654248,transparent:true,opacity:.4})));
    const dots = new Group();globe.add(dots);
    const dotGeometry = new SphereGeometry(.010, 10, 6);
    const dotMaterial = new MeshBasicMaterial({color:0xffffff});
    let instances: InstanceType<typeof InstancedMesh> | undefined;
    updateMarkers = data => {
      if (instances) { dots.remove(instances); instances.dispose(); instances = undefined; }
      const markers = visitorMarkers(data, countries);
      if (!markers.length) return;
      instances = new InstancedMesh(dotGeometry, dotMaterial, markers.length);
      const transform = new Object3D();
      markers.forEach((item, i) => {
        transform.position.copy(position(item.lat, item.lon, 1.018));
        transform.scale.setScalar(Math.min(2.8, 1 + Math.log10(item.count) * .4));
        transform.updateMatrix(); instances!.setMatrixAt(i, transform.matrix);
        instances!.setColorAt(i, new Color(item.regional ? 0xffd0ba : 0x94635e));
      });
      instances.instanceMatrix.needsUpdate = true;
      if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
      dots.add(instances);
    };
    if (latest) updateMarkers(latest);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let paused = motion.matches, visible = true, frame = 0, last = 0;
    const draw = (time: number) => {
      frame = 0;
      if (stopped || document.hidden || !visible) return;
      if (!paused) globe.rotation.y += Math.min((time-last)/1000,.05)*.12;
      last=time;renderer.render(scene,camera);
      if (!paused) frame=requestAnimationFrame(draw);
    };
    const start = () => { if (!frame && !stopped) {last=performance.now();frame=requestAnimationFrame(draw);} };
    const resize = () => {
      const {width,height}=canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();start();
    };
    const observer = new ResizeObserver(resize);observer.observe(canvas);
    const intersection = new IntersectionObserver(entries => { visible=entries[0].isIntersecting;start(); });intersection.observe(canvas);
    const toggle = () => {paused=!paused;button.textContent=paused?"Resume rotation":"Pause rotation";start();};
    const onMotion = () => {paused=motion.matches;button.textContent=paused?"Resume rotation":"Pause rotation";start();};
    const onVisible = () => start();
    button.hidden=false;button.textContent=paused?"Resume rotation":"Pause rotation";button.addEventListener("click",toggle);
    motion.addEventListener("change",onMotion);document.addEventListener("visibilitychange",onVisible);
    const originalMarkers=updateMarkers;updateMarkers=data=>{originalMarkers(data);start();};
    resize();
    dispose=()=>{
      cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();
      motion.removeEventListener("change",onMotion);document.removeEventListener("visibilitychange",onVisible);button.removeEventListener("click",toggle);
      scene.traverse(object=>{if(object instanceof Mesh || object instanceof LineSegments){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});
      instances?.dispose();dotGeometry.dispose();dotMaterial.dispose();renderer.dispose();
    };
  } catch {
    canvas.hidden=true;document.getElementById("globe-fallback")!.hidden=false;
  }
}
