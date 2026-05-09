function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iWireframeIndexBuffer = gl.createBuffer();
    this.count = 0;
    this.wireCount = 0;

    this.bindSurfaceAttributes = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        if (shProgram.iAttribTexcoord !== -1) {
            gl.disableVertexAttribArray(shProgram.iAttribTexcoord);
        }
    };

    this.makeWireframeIndices = function(indices) {
        const wire = new Uint16Array(indices.length * 2);
        for (let i = 0, w = 0; i < indices.length; i += 3) {
            const a = indices[i];
            const b = indices[i + 1];
            const c = indices[i + 2];
            wire[w++] = a; wire[w++] = b;
            wire[w++] = b; wire[w++] = c;
            wire[w++] = c; wire[w++] = a;
        }
        return wire;
    };

    this.BufferData = function(vertices, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        this.bindSurfaceAttributes();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        this.count = indices.length;

        const wireIndices = this.makeWireframeIndices(indices);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iWireframeIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);
        this.wireCount = wireIndices.length;
    }

    this.Draw = function() {
        this.bindSurfaceAttributes();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    this.DrawWireframe = function() {
        this.bindSurfaceAttributes();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iWireframeIndexBuffer);
        gl.drawElements(gl.LINES, this.wireCount, gl.UNSIGNED_SHORT, 0);
    }
}


function CreateSurfaceData(data)
{
    const uSegments = 80;
    const vSegments = 36;
    const row = vSegments + 1;
    const vertexCount = (uSegments + 1) * row;
    const vertices = new Float32Array(vertexCount * 3);
    const indices = [];

    function shoePoint(out, idx, u, v) {
        const x = (u - 0.5) * 4.2;
        const toeBulge = 0.25 * Math.exp(-Math.pow((u - 0.88) / 0.18, 2));
        const widthProfile = 0.42 + 0.20 * Math.sin(Math.PI * u) + toeBulge;
        const y = widthProfile * v * (0.95 - 0.18 * u);
        const arch = 0.24 * Math.sin(Math.PI * u);
        const sole = -0.18 * (x * x) / 4.41;
        const crossShape = 0.07 * Math.cos(Math.PI * v);
        out[idx] = x;
        out[idx + 1] = y;
        out[idx + 2] = arch + sole + crossShape;
    }

    for (let i = 0, k = 0; i <= uSegments; i++) {
        const u = i / uSegments;
        for (let j = 0; j <= vSegments; j++) {
            const v = (j / vSegments) * 2.0 - 1.0;
            shoePoint(vertices, k, u, v);
            k += 3;
        }
    }

    for (let i = 0; i < uSegments; i++) {
        for (let j = 0; j < vSegments; j++) {
            const i0 = i * row + j;
            const i1 = i0 + 1;
            const i2 = i0 + row;
            const i3 = i2 + 1;

            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    data.verticesF32 = vertices;
    data.indicesU16 = Uint16Array.from(indices);
}