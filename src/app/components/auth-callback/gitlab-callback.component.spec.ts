import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { GitlabCallbackComponent } from "./gitlab-callback.component";

describe("GitlabCallbackComponent", () => {
  let component: GitlabCallbackComponent;
  let fixture: ComponentFixture<GitlabCallbackComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj("Router", ["navigate"]);

    await TestBed.configureTestingModule({
      declarations: [GitlabCallbackComponent],
      imports: [TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => {
                  if (key === "code") return "test-code";
                  if (key === "state") return "test-state";
                  return null;
                },
              },
            },
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GitlabCallbackComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should postMessage to opener and close if opener exists", () => {
    const postMessageSpy = jasmine.createSpy("postMessage");
    const closeSpy = jasmine.createSpy("close");

    (window as any).opener = { postMessage: postMessageSpy };
    spyOn(window, "close").and.callFake(closeSpy);

    component.ngOnInit();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: "GITLAB_OAUTH_CALLBACK",
        code: "test-code",
        state: "test-state",
        error: null,
        errorDescription: null,
      },
      window.location.origin,
    );
    expect(closeSpy).toHaveBeenCalled();

    delete (window as any).opener;
  });

  it("should navigate to home if no window.opener", () => {
    delete (window as any).opener;
    component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(["/home"]);
  });
});
