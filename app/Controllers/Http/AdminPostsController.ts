import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import {
  CreatePostValidator,
  UpdatePostValidator,
} from "App/Validators/PostValidator";

import { createConfirmDeleteLink } from "App/Services/HelpersService";
import Database from "@ioc:Adonis/Lucid/Database";
import Post from "App/Models/Post";

export default class AdminPostsController {
  // controller config
  private entityTable = "posts";
  private entityModel = Post;
  private entityListPath = "/admin/posts";
  private entityIndexView = "pages/admin/posts";
  private entityFormView = "pages/admin/postForm";
  private entityCreateValidator = CreatePostValidator;
  private entityFormAction = (entity) => {
    return "/admin/posts/" + entity.id;
  };
  private entityCreationNotification = () => "Post has been created";
  private entityUpdateNotification = () => "Post has been updated";
  private entityDeleteNotification = () => "Post has been deleted";

  /**
   * Liste des posts pour l'admin
   */
  public async index({ view, request, bouncer }: HttpContextContract) {
    await bouncer.authorize("adminListPosts");
    const page = request.input("page", 1);
    const limit = 20;
    const entities = await Database.from(this.entityTable)
      .join("users", "users.id", "=", "posts.user_id")
      .select("posts.*")
      .select("users.name as userName", "users.id as userId")
      .paginate(page, limit);
    entities.baseUrl(this.entityListPath);

    // add delete links and edit Links for each post.
    entities.forEach((entity) => {
      const deleteLink = createConfirmDeleteLink({
        id: entity.id,
        title: `Are you sure you want to delete "${entity.title}" ?`,
        formAction: `${this.entityListPath}/${entity.id}?_method=DELETE`,
        returnUrl: this.entityListPath,
      });
      entity._deleteLink = deleteLink;
      entity._editLink = `${this.entityListPath}/${entity.id}/edit`;
    });

    return view.render(this.entityIndexView, { entities });
  }

  public async create({ view, bouncer }: HttpContextContract) {
    await bouncer.authorize("adminCreatePost");
    const formValues = this.initFormValues();
    return view.render(this.entityFormView, {
      formValues,
      formAction: this.entityListPath,
    });
  }

  public async store({
    session,
    request,
    response,
    auth,
    bouncer,
  }: HttpContextContract) {
    await bouncer.authorize("adminCreatePost");
    const payload = await request.validate(this.entityCreateValidator);
    await this.entityModel.create({
      title: payload.title,
      content: payload.content,
      userId: auth.user!.id,
    });
    session.flash({
      notification: this.entityCreationNotification(),
    });
    response.redirect(this.entityListPath);
  }

  public async show({}: HttpContextContract) {}

  public async edit({ view, request, bouncer }: HttpContextContract) {
    const entity = await this.entityModel.findOrFail(request.param("id"));
    await bouncer.authorize("adminEditPost", entity);
    if (entity) {
      const formValues = this.initFormValues(entity);
      return view.render(this.entityFormView, {
        formValues,
        formAction: this.entityFormAction(entity) + "?_method=PUT",
      });
    }
  }

  public async update({
    request,
    session,
    response,
    bouncer,
  }: HttpContextContract) {
    const payload = await request.validate(UpdatePostValidator);
    const entity = await this.entityModel.findOrFail(payload.id);
    bouncer.authorize("adminEditPost", entity);
    entity.title = payload.title;
    entity.content = payload.content || "";
    await entity.save();
    session.flash({ notification: this.entityUpdateNotification() });
    response.redirect(this.entityListPath);
  }

  public async destroy({
    request,
    response,
    session,
    bouncer,
  }: HttpContextContract) {
    const entity = await this.entityModel.findOrFail(request.param("id"));
    await bouncer.authorize("adminDeletePost", entity);
    if (entity) {
      entity.delete();
      session.flash({ notification: this.entityDeleteNotification() });
      response.redirect(this.entityListPath);
    }
  }

  private initFormValues(post?: Post) {
    const formValues = {
      id: post ? post.id : "",
      title: post ? post.title : "",
      content: post ? post.content : "",
    };
    return formValues;
  }
}
