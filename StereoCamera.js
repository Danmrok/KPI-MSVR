function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance)
{
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = FOV * Math.PI / 180.0;
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;

    this.CreateFrustumMatrix = function(left, right, bottom, top, near, far) {
        const temp = 2.0 * near;
        const temp2 = right - left;
        const temp3 = top - bottom;
        const temp4 = far - near;
        return [
            temp / temp2, 0, 0, 0,
            0, temp / temp3, 0, 0,
            (right + left) / temp2, (top + bottom) / temp3, -(far + near) / temp4, -1,
            0, 0, -temp * far / temp4, 0
        ];
    };

    this._eye = function(sign) {
        const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2.0);
        const bottom = -top;
        const a = this.mAspectRatio * Math.tan(this.mFOV / 2.0) * this.mConvergence;
        const b = a - this.mEyeSeparation / 2.0;
        const c = a + this.mEyeSeparation / 2.0;
        const left = sign < 0
            ? -b * this.mNearClippingDistance / this.mConvergence
            : -c * this.mNearClippingDistance / this.mConvergence;
        const right = sign < 0
            ? c * this.mNearClippingDistance / this.mConvergence
            : b * this.mNearClippingDistance / this.mConvergence;
        return {
            projectionMatrix: this.CreateFrustumMatrix(
                left,
                right,
                bottom,
                top,
                this.mNearClippingDistance,
                this.mFarClippingDistance
            ),
            eyeShift: -sign * this.mEyeSeparation / 2.0
        };
    };

    this.ApplyLeftFrustum = function() {
        return this._eye(-1);
    };

    this.ApplyRightFrustum = function() {
        return this._eye(1);
    };
}
