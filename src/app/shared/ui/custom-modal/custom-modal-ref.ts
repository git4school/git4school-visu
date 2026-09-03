export class CustomModalRef {
  private _resolve: (result?: any) => void;
  private _reject: (reason?: any) => void;

  /**
   * Promise that resolves when the modal is closed and rejects when it is dismissed.
   */
  public result: Promise<any>;

  /**
   * The instance of component opened in the modal
   */
  public componentInstance: any;

  constructor(private containerRef: any) {
    this.result = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Closes the modal with an optional result.
   */
  close(result?: any) {
    if (this.containerRef) {
      this.containerRef.destroyModal().then(() => {
        this._resolve(result);
      });
    }
  }

  /**
   * Dismisses the modal with an optional reason.
   */
  dismiss(reason?: any) {
    if (this.containerRef) {
      this.containerRef.destroyModal().then(() => {
        this._reject(reason);
      });
    }
  }
}
