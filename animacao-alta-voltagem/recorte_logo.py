import cv2, numpy as np, sys
from scipy import ndimage as ndi
src, out, prev = sys.argv[1:4]
img = cv2.imread(src).astype(np.float32)
up = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4).clip(0,255)
H,W = up.shape[:2]
g = cv2.cvtColor(up.clip(0,255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
hf = np.abs(g - cv2.GaussianBlur(g,(0,0),3))
edge = ndi.binary_dilation(hf > 10, iterations=6)
fill = ndi.binary_fill_holes(edge)
lab, n = ndi.label(fill); sizes = ndi.sum(fill, lab, range(1,n+1))
keep = np.isin(lab, 1+np.where(sizes > 4000)[0])
keep = ndi.binary_fill_holes(keep)
keep = ndi.binary_erosion(keep, iterations=5)
outside = (~ndi.binary_dilation(keep, iterations=4)).astype(np.float32)
num = cv2.GaussianBlur(up*outside[...,None],(0,0),30); den = cv2.GaussianBlur(outside,(0,0),30)[...,None]+1e-4
bgest = num/den
dist = np.linalg.norm(up-bgest,axis=2)
yy,xx = np.mgrid[0:H,0:W]
# top side zones where bolts float over the background
zone = (yy < 0.36*H) & ((xx < 0.33*W) | (xx > 0.70*W))
zone |= (yy < 0.20*H) & ((xx < 0.36*W) | (xx > 0.66*W))
soft = np.clip((dist-40)/40,0,1)
a = cv2.GaussianBlur(keep.astype(np.float32),(0,0),1.2)
zs = cv2.GaussianBlur(zone.astype(np.float32),(0,0),12)
a = a*(1-zs) + np.minimum(a,soft)*zs
rgba = np.dstack([up.clip(0,255), a*255]).astype(np.uint8)
cv2.imwrite(out, rgba)
for name,col in [(prev,(40,20,20)),(prev.replace('.jpg','_w.jpg'),(230,230,230))]:
    bg = np.zeros_like(up); bg[:]=col
    comp = up*a[...,None] + bg*(1-a[...,None])
    cv2.imwrite(name, cv2.resize(comp,(800,800)).astype(np.uint8))
